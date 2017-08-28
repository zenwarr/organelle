import {FullResourceData, LibraryDatabase, ResolvedRelatedObject, UpdateRelatedObject} from "./library-db";
import {AbstractStorage} from "./storage";
import {Database} from "./db";

export class Library {
  constructor(lib: LibraryDatabase) {
    this._lib = lib;
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

  *objectLocations(obj: string|UpdateRelatedObject): IterableIterator<Promise<string>> {
    obj = Database.getId(obj);
    for (let storage of this._storages) {
      let locations = storage.objectLocations(obj);
      for (let location of locations) {
        yield location;
      }
    }
  }

  async firstObjectLocation(obj: string|UpdateRelatedObject): Promise<string> {
    let location = this.objectLocations(obj).next();
    if (location == null) {
      throw new Error();
    } else {
      return location.value;
    }
  }

  async getFullResourceData(uuid: string): Promise<FullResourceData|null> {
    let resource = await this._lib.getResource(uuid);
    if (!resource) {
      return null;
    }

    let rd = resource as FullResourceData;
    rd.relatedGroups = await this._lib.relatedGroups(resource);
    rd.relatedPersons = await this._lib.relatedPersons(resource);

    rd.relatedObjects = [];
    let relatedObjects = await this._lib.relatedObjects(resource);
    for (let relatedObject of relatedObjects) {
      let locationCount = 0;
      for (let locationPromise of this.objectLocations(relatedObject)) {
        let location = await locationPromise;
        rd.relatedObjects.push({ ...relatedObject, location: location });
        ++locationCount;
      }
      if (!locationCount) {
        rd.relatedObjects.push({ ...relatedObject, location: null });
      }
    }

    return rd;
  }

  /** Protected area **/

  protected _lib: LibraryDatabase;
  protected _root: string|null = null;
  protected _storages: AbstractStorage[] = [];
}
