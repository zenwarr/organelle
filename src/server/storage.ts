import {ConfigOption, StorageDatabase, StorageObject} from "./storage-db";
import {isValidTemplate, TemplateProcessor} from "./formatter";
import * as path from "path";
import * as fs from 'fs-extra';
import {Database} from "./db";
import {UpdateRelatedObject} from "../common/db";

const DEF_FILE_TEMPLATE = '{author} - {title}';
const DEF_DB_FILENAME = 'storage.db';

export interface ImportOptions {
  overwrite: boolean;
}

export const DEF_IMPORT_OPTIONS: ImportOptions = {
  overwrite: false
};

export abstract class AbstractStorage {
  abstract get uuid(): string|null;
  abstract objectLocations(uuid: string|UpdateRelatedObject): IterableIterator<Promise<string>>;
}

export class FileSystemStorage extends AbstractStorage {
  *objectLocations(uuid: string|UpdateRelatedObject): IterableIterator<Promise<string>> {
    yield new Promise<string>((resolve, reject) => {
      this.db.getObject(Database.getId(uuid)).then(storageObject => {
        if (storageObject && storageObject.location) {
          let objPath = path.resolve(storageObject, this.root);
          resolve('file:///' + objPath);
        } else {
          reject(new Error('No object with given UUID found'));
        }
      });
    });
  }

  get uuid(): string|null {
    return this._db.uuid;
  }

  get root(): string {
    return this._root;
  }

  get defaultFileTemplate(): string {
    let template = this._db.getOption(ConfigOption.DefaultFileTemplate);
    return template ? template : DEF_FILE_TEMPLATE;
  }

  set defaultFileTemplate(template: string) {
    if (!template || !isValidTemplate(template)) {
      throw new Error('Cannot set file template for storage: template is invalid');
    }

    this._db.setOption(ConfigOption.DefaultFileTemplate, template);
  }

  static async load(root: string): Promise<FileSystemStorage> {
    let db = new StorageDatabase(path.join(root, DEF_DB_FILENAME));
    await db.open();
    return new FileSystemStorage(root, db);
  }

  static async create(root: string): Promise<FileSystemStorage> {
    let db = new StorageDatabase(path.join(root, DEF_DB_FILENAME));
    await db.create();
    return new FileSystemStorage(root, db);
  }

  async importObject(uuid: string|null, srcFilename: string, proc: TemplateProcessor,
                     options?: ImportOptions): Promise<StorageObject> {
    if (!srcFilename || !path.isAbsolute(srcFilename)) {
      throw new Error(`Cannot import the object into the storage: source file path is invalid [${srcFilename}]`);
    }

    let relTargetFilename = await proc.process(this.defaultFileTemplate);
    if (relTargetFilename) {
      if (path.isAbsolute(relTargetFilename)) {
        throw new Error(`Cannot import the object into the storage: path generated by template is absolute, not relative [${relTargetFilename}]`);
      }

      let srcExt = path.extname(srcFilename);
      if (srcExt) {
        relTargetFilename += srcExt;
      }

      let targetFilename = path.join(this.root, relTargetFilename);

      await fs.copy(srcFilename, targetFilename, {
        overwrite: options && options.overwrite,
        errorOnExist: true,
        preserveTimestamps: true
      });

      return this.db.registerObject({
        uuid: uuid,
        location: relTargetFilename
      });
    } else {
      throw new Error('Cannot import the object into the storage: no path generated by template');
    }
  }

  async removeObject(obj: Object|string): Promise<void> {
    let storageObject = await this.db.getObject(Database.getId(obj));
    if (storageObject) {
      let absLocation = path.join(this.root, storageObject.location);
      await fs.unlink(absLocation);
      return this.db.unregisterObject(storageObject);
    } else {
      throw new Error(`Failed to remove object from storage: no object with given UUID found [${obj}]`);
    }
  }

  /** Protected area **/

  protected _root: string;
  protected _db: StorageDatabase;

  protected constructor(root: string, db: StorageDatabase) {
    super();
    this._root = root;
    this._db = db;
  }

  get db(): StorageDatabase {
    return this._db;
  }
}
