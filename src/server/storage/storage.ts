import {ObjectEntry, ResourceEntry} from "../db/driver";
import * as path from "path";
import * as fs from "fs";

export class PathFormat {
  constructor(protected _template: string) {};

  get template(): string { return this._template; }

  // doFormat(resource: ResourceEntry, object: ObjectEntry): string;
}

export enum StorOption {
  Template = 'template',
  Uuid = 'uuid',
  Title = 'title'
}

const STORAGE_CONFIG_DEFAULT_FILENAME = 'storage.json';
export const MAX_STORAGE_VERSION = 1;

export type StorageRawConfig = {
  version?: string,
  public_config?: {
    [name: string]: string;
  },
  private_config?: {
    [name: string]: string;
  },
  objects?: {
    [uuid: string]: {
      location: string;
    }
  },
  covers?: {
    [uuid: string]: {
      location: string;
    }
  }
};

export class Storage {
  protected _rootLocation: string|null;
  protected _rawConfig: StorageRawConfig|null = null;

  constructor(protected rootLocation: string|null) {
    this._rootLocation = rootLocation;
  }

  /**
   * Loads and parses storage configuration file with default name. Configuration file should be located in a root
   * directory of storage and be named as ${STORAGE_CONFIG_DEFAULT_FILENAME}. Configuration should have
   * public_config.uuid specified, otherwise parsing will fail.
   * @returns {Promise<StorageRawConfig>} Parsed configuration.
   */
  static parseConfig(rootLocation: string): Promise<StorageRawConfig> {
    return new Promise<StorageRawConfig>((resolve, reject) => {
      let configFilename = path.join(rootLocation, STORAGE_CONFIG_DEFAULT_FILENAME);
      fs.readFile(configFilename, { encoding: 'utf-8' }, (err: Error, data: string) => {
        if (!err && data) {
          try {
            let conf = JSON.parse(data) as StorageRawConfig;

            let err = Storage.isValidConfig(conf);
            if (err) {
              reject(err);
            } else {
              resolve(conf);
            }
          } catch (e) {
            reject(new Error('Failed to parse storage config file: ' + e.message));
          }
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Applies configuration to current storage.
   * @param {StorageRawConfig} conf Configuration object to apply.
   */
  protected applyConfig(conf: StorageRawConfig): void {
    this._rawConfig = conf;
  }

  static isValidConfig(conf: StorageRawConfig): Error|null {
    // Check storage version
    if (!conf.version || isNaN(parseInt(conf.version)) || parseInt(conf.version) > MAX_STORAGE_VERSION) {
      return new Error(`Failed to parse storage config: unsupported version (${conf.version})`);
    }

    // Check if UUID is specified
    if (!conf.public_config || !conf.public_config[StorOption.Uuid]) {
      return new Error('Failed to parse storage config file: no public_config.uuid found');
    }

    // OK
    return null;
  }

  /**
   * Loads storage from given root location.
   * @param {string} rootLocation Path to root directory of storage to load.
   * @returns {Promise<Storage>} Initialized storage.
   */
  static load(rootLocation: string): Promise<Storage> {
    return new Promise<Storage>((resolve, reject) => {
      let storage = new Storage(rootLocation);
      Storage.parseConfig(rootLocation).then((conf: StorageRawConfig) => {
        storage.applyConfig(conf);
        resolve(storage);
      }, (err: Error) => {
        reject(new Error(`Failed to load a storage at location ${rootLocation}: ${err.message}`));
      });
    });
  }

  /**
   * Raw configuration object for this storage. Do
   * @returns {StorageRawConfig}
   */
  get rawConfig(): StorageRawConfig|null { return this._rawConfig; }

  /**
   * Storage identifier.
   * @returns {string}
   */
  get uuid(): string|null {
    if (this._rawConfig && this._rawConfig.public_config && this._rawConfig.public_config[StorOption.Uuid]) {
      return this._rawConfig.public_config[StorOption.Uuid];
    } else {
      return null;
    }
  }

  /**
   * Each storage has a title. Here it is.
   * @returns {string}
   */
  get title(): string {
    if (this._rawConfig && this._rawConfig.public_config && this._rawConfig.public_config[StorOption.Title]) {
      return this._rawConfig.public_config[StorOption.Title];
    } else {
      return '';
    }
  }

  get defaultPathFormat(): PathFormat|null {
    if (this._rawConfig && this._rawConfig.private_config && this._rawConfig.private_config[StorOption.Template]) {
      return new PathFormat(this._rawConfig.private_config[StorOption.Template]);
    } else {
      return null;
    }
  }

  /**
   * Look for object with given UUID
   * @param {string} uuid
   * @returns {Promise<{err: Error; object: StorageObject}>}
   */
  // findObject(uuid: string): Promise<StorageObject>;

  /**
   * Look for objects by location.
   * @param {string|RegExp} If the parameter is a plain string, function looks for objects which location exactly matches
   * the value of the parameter. You can provide a regular expression to search for.
   * @returns {Promise<{err: Error; object: StorageObject[]}>}
   */
  // findObjectByLocation(location: string|RegExp): Promise<{err: Error, object: StorageObject[]}>;

  /**
   * Adds record for an object into storage database. Does not add a real file to the storage.
   * @param {string} uuid
   * @param {string} location
   * @returns {Promise<{err: Error; object: StorageObject}>}
   */
  // registerObject(uuid: string, location: string): Promise<{err: Error, object: StorageObject}>;

  /**
   * Removes record for an object from storage database. Does not remove any real files from the storage.
   * @param {string} uuid
   * @returns {Promise<{err: Error}>}
   */
  // unregisterObject(uuid: string): Promise<{err: Error}>;

  /**
   * Updates object record in storage database. Does not affects any real files in the storage.
   * @param {string} uuid
   * @param {string} location
   * @returns {Promise<{err: Error; object: StorageObject}>}
   */
  // updateObject(uuid: string, location: string): Promise<{err: Error, object: StorageObject}>;

  /**
   *
   * @param {string} source
   * @returns {Promise<{err: Error; object: StorageObject}>}
   */
  // storeObject(source: string): Promise<{err: Error, object: StorageObject}>;

  /**
   *
   * @param {string} uuid
   * @returns {Promise<{err: Error; object: StorageObject}>}
   */
  // removeObject(uuid: string): Promise<{err: Error, object: StorageObject}>;
}

export class StorageObject {
  uuid: string;
  location: string;
}
