import {LibraryDatabase, RelatedObject, Resource} from "./library-db";
import {StorageDatabase, StorageObject} from "./storage-db";
import {AbstractStorage} from "./storage";
import {Database} from "./db";

export class Library {
  constructor(protected _lib: LibraryDatabase) {

  }

  get libraryDatabase(): LibraryDatabase {
    return this._lib;
  }

  addStorage(storage: AbstractStorage): void {
    if (storage == null) {
      throw new Error('Invalid argument');
    }

    if (this._storages.some(stor => stor === storage)) {
      return;
    }

    this._storages.push(storage);
  }

  getStorages(): AbstractStorage[] {
    return [ ...this._storages ];
  }

  removeStorage(uuid: string): void {
    uuid = Database.validateId(uuid);
    this._storages.filter(stor => stor.uuid === uuid);
  }

  *objectLocations(obj: string|RelatedObject): IterableIterator<Promise<string>> {
    obj = Database.getId(obj);
    for (let storage of this._storages) {
      let locations = storage.objectLocations(obj);
      for (let location of locations) {
        yield location;
      }
    }
  }

  async firstObjectLocation(obj: string|RelatedObject): Promise<string> {
    let location = this.objectLocations(obj).next();
    if (location == null) {
      throw new Error();
    } else {
      return location.value;
    }
  }

  /** Protected area **/

  protected _root: string;
  protected _storages: AbstractStorage[];
}
