import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as uuid from 'uuid';

export type Savepoint = string;

export class Database {
  constructor(filename: string) {
    this._filename = path.normalize(filename);
  }

  /**
   * Database filename
   * @returns {string}
   */
  get filename(): string { return this._filename; }

  /**
   * Creates new database. If file already exists, the function will fail.
   * @returns {Promise<void>}
   */
  async create(): Promise<void> {
    this._ensureNotInited();
    this._db = await sqlite.open(this._filename,
        { mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, promise: Promise });
    await this._tuneConnection();
  }

  /**
   * Opens already existing database. If no file found, the function will fail.
   * @returns {Promise<void>}
   */
  async open(): Promise<void> {
    this._ensureNotInited();
    this._db = await sqlite.open(this._filename, { mode: sqlite3.OPEN_READWRITE, promise: Promise });
    await this._tuneConnection();
  }

  async createOrOpen(): Promise<void> {
    try {
      await this.open();
    } catch (err) {
      if (err.code === 'SQLITE_CANTOPEN') {
        // try to create a new database...
        await this.create();
      } else {
        throw err;
      }
    }
  }

  /**
   * Sqlite database object
   * @returns {sqlite.Database}
   */
  get db(): sqlite.Database { return this._db; }

  static getId(something: string|{ uuid?: string|null }): string {
    if (typeof something === 'string') {
      return something;
    } else if (something.uuid) {
      return something.uuid;
    } else {
      throw new Error('UUID is invalid or empty');
    }
  }

  static validateId(uuid: string|null|undefined): string {
    if (uuid == null || uuid.length === 0) {
      throw new Error('Invalid or empty UUID');
    }
    return uuid.toLowerCase().trim();
  }

  /** Protected area **/

  protected _filename: string;
  protected _db:sqlite.Database;

  protected _ensureNotInited() {
    if (this._db != null) {
      throw new Error('Cannot create/open already initialized database');
    }
  }

  protected async _tuneConnection() {
    await this.db.run('PRAGMA foreign_keys = TRUE');
  }
}

export class DatabaseWithOptions extends Database {
  constructor(filename: string, protected _version: number) {
    super(filename);
  }

  async create(): Promise<void> {
    if (this._version == null) {
      this._version = 0;
    }

    const SCHEMA: string[] = [
      "CREATE TABLE config(name TEXT UNIQUE PRIMARY KEY, value TEXT NOT NULL)",
      `PRAGMA user_version = "${this._version}"`,
      `INSERT INTO config(name, value) VALUES('uuid', '${uuid.v4()}')`
    ];

    await super.create();
    for (let query of SCHEMA) {
      await this.db.run(query);
    }
    await this._loadConfig();
  }

  async open(): Promise<void> {
    await super.open();
    await this._loadConfig();
  }

  /**
   * Get configuration option with given name. Supported options are enumerated in ConfigOption enum.
   * If no option with given name found, returns null. Otherwise returns value of the option. All options
   * are strings.
   * @param {string} name Option name
   * @returns {string|null} Option value or null if the option does not exist
   */
  getOption(name: string): string|null {
    name = name.toLowerCase();
    if (this._config.hasOwnProperty(name)) {
      return this._config[name];
    } else {
      return null;
    }
  }

  /**
   * Sets a configuration option with given name. If option does not exist, new one will be created and stored in db.
   * @param {string} name Option name
   * @param {string} value Option value to set
   * @returns {Promise<void>} Resolved when the option have been successfully stored in the database.
   */
  async setOption(name: string, value: string) : Promise<void> {
    name = name.toLowerCase();

    let query: string;
    if (this._config.hasOwnProperty(name)) {
      query = "UPDATE config SET value = $value WHERE name = $name";
    } else {
      query = "INSERT INTO config(name, value) VALUES($name, $value)"
    }

    await this.db.run(query, { $name: name, $value: value });
    this._config[name] = value;
  }

  /**
   * Shorthand function for getting UUID of the current storage.
   * @returns {string}
   */
  get uuid(): string|null { return this.getOption('uuid'); }

  async begin(): Promise<Savepoint> {
    let svp = this._generateSavepoint();
    await this._db.run(`SAVEPOINT ${svp}`);
    return svp;
  }

  async commit(svp: Savepoint): Promise<void> {
    await this._db.run(`RELEASE ${svp}`)
  }

  async rollback(svp: Savepoint): Promise<void> {
    await this._db.run(`ROLLBACK TO ${svp}`);
  }

  /** Protected area **/

  protected _config: { [name: string] : string; } = {};

  /**
   * Loads configuration options (config table) from database.
   * @returns {Promise<void>}
   * @private
   */
  protected async _loadConfig(): Promise<void> {
    // check if library has correct version
    let versionPragma: { user_version: number };
    try {
      versionPragma = await this.db.get<{ user_version: number }>('PRAGMA user_version');
      if (versionPragma == null || !Number.isInteger(versionPragma.user_version)) {
        throw new Error();
      }
    } catch (err) {
      throw new Error('Failed to understand which version storage database is');
    }

    if (versionPragma.user_version > this._version) {
      throw new Error('Storage database version is unsupported');
    }

    let configData = await this.db.all<{ name: string, value: string }>("SELECT name, value FROM config");
    configData.map(item => {
      this._config[item.name.toLowerCase()] = item.value;
    });
  }

  protected _generateSavepoint(): string {
    return 'sv' + (new Date()).getTime();
  }
}
