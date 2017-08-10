import {LibraryDatabase, Resource} from "./library-db";
import {StorageDatabase, StorageObject} from "./storage-db";

export class Library {
  static async load(root: string): Promise<LibraryDatabase> {
    throw new Error("Method not implemented");
  }

  static async create(root: string): Promise<LibraryDatabase> {
    throw new Error("Method not implemented");
  }

  get root(): string {
    return this._root;
  }

  get libraryDatabase(): LibraryDatabase {
    return this._lib;
  }

  get storageDatabase(): StorageDatabase {
    return this._storage;
  }

  /** Protected area **/

  protected _root: string;
  protected _lib: LibraryDatabase;
  protected _storage: StorageDatabase;

  protected constructor(root: string) {
    this._root = root;
    throw new Error("Method not implemented");
  }
}
