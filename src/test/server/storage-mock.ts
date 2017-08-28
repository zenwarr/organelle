import {AbstractStorage} from "../../server/storage";
import {UpdateRelatedObject} from "../../server/library-db";

export const OBJ1 = '1uuid',
    OBJ2 = '2uuid',
    OBJ3 = '3uuid',
    OBJ4 = '4uuid';

export class StorageMock extends AbstractStorage {
  get uuid() { return null; }

  *objectLocations(uuid: string | UpdateRelatedObject): IterableIterator<Promise<string>> {
    function promiseIt(value: any): Promise<any> {
      return (async() => value)();
    }

    switch (uuid) {
      case OBJ1:
        yield promiseIt('organelle://loc1');
        yield promiseIt('organelle://loc2');
        break;

      case OBJ2:
        yield promiseIt('organelle://loc2');
        break;

      case OBJ3:
        break;

      case OBJ4:
        yield promiseIt('organelle://loc3');
    }
  }
}
