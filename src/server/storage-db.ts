import {Database, DatabaseWithOptions} from './db';
import * as uuid from 'uuid';
import {WhereClauseBuilder} from "./library-db";

export const CUR_STORAGE_VERSION = 1;

export enum ConfigOption {
  Uuid = 'uuid',
  Title = 'title',
  DefaultFileTemplate = 'def_template'
}

export class StorageDatabase extends DatabaseWithOptions {
  constructor(filename: string) {
    super(filename, CUR_STORAGE_VERSION);
  }

  /**
   * Creates new storage database at location determined by this object. If the file already exists, the func will fail.
   * New storage UUID is generated and stored in the database.
   * @returns {Promise<void>}
   */
  async create(): Promise<void> {
    await super.create();

    const SD_SCHEMA: string[] = [
      "CREATE TABLE objects(uuid TEXT UNIQUE PRIMARY KEY, location TEXT NOT NULL)",
      "CREATE TABLE covers(uuid TEXT UNIQUE PRIMARY KEY, location TEXT NOT NULL)",
    ];

    for (let query of SD_SCHEMA) {
      await this.db.run(query);
    }
  }

  /**
   * Adds a record for an object to the database. Does not copy any real files into the current storage.
   * @param {StorageObject} obj Object to register. If object has UUID specified, it should not match any already
   * existing object, otherwise the func will fail. If no UUID specified, new one will be generated and assigned to
   * the object.
   * @returns {Promise<StorageObject>} StorageObject that describes the object registered. This is always a new object, not
   * the one you've passed as an argument.
   */
  async registerObject(obj: StorageObject): Promise<StorageObject> {
    let newObject = { uuid: obj.uuid, location: obj.location };
    if (newObject.uuid == null) {
      newObject.uuid = uuid.v4().toLowerCase();
    }

    if (!newObject.location) {
      throw new Error('Cannot register an object with empty location');
    }

    await this.db.run("INSERT INTO objects(uuid, location) VALUES($uuid, $location)", {
      $uuid: newObject.uuid,
      $location: newObject.location
    });

    return newObject;
  }

  /**
   * Looks for the object with given UUID. If no object with the UUID found, promise will be resolved to null.
   * @param {string} uuid Identifier of the object to search
   * @returns {Promise<StorageObject>} Object from the database with given UUID or null of database has no objects
   * with this UUID.
   */
  async getObject(uuid: string): Promise<StorageObject|null> {
    let row = await this.db.get<{ location: string }|null>("SELECT location FROM objects WHERE uuid = $uuid", {
      $uuid: uuid.toLowerCase()
    });

    if (row == null) {
      return null;
    }

    return { uuid: uuid, location: row.location };
  }

  /**
   * Modifies already registered object.
   * @param {StorageObject} obj Describes object the function should modify. uuid property points to an objects and
   * should not be null, otherwise the function is going to fail. Other properties are the new properties that should
   * be applied to the object.
   * @returns {Promise<StorageObject>} StorageObject for the modified object with new properties. This is always a new
   * object, not the one you've passed as an argument.
   */
  async updateObject(obj: StorageObject): Promise<StorageObject> {
    if (obj.uuid == null || obj.uuid.length === 0) {
      throw new Error('Empty object UUID');
    }

    let stmt = await this.db.run("UPDATE objects SET location = $location WHERE uuid = $uuid", {
      $uuid: obj.uuid,
      $location: obj.location
    });

    if (stmt.changes === 0) {
      throw new Error(`Cannot update object with UUID = ${obj.uuid}. Object does not exist`);
    }

    return { uuid: obj.uuid, location: obj.location };
  }

  /**
   * Removes registered object with given UUID from the database. If no object with given UUID exists, the function
   * will fail.
   * @param {string} obj UUID of the object to remove.
   * @returns {Promise<void>}
   */
  async unregisterObject(obj: StorageObject|string): Promise<void> {
    let where = new WhereClauseBuilder();
    where.add('uuid', Database.getId(obj));

    let stmt = await this.db.run(`DELETE FROM objects ${where.clause}`, where.bound);

    if (stmt.changes === 0) {
      throw new Error(`Cannot remove object with UUID = ${obj}. Object does not exist`);
    }
  }

  /** Protected area **/
}

export interface StorageObject {
  uuid: string|null;
  location: string;
}
