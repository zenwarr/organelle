import {createTestLib} from "../test/server/testlib";
import * as testlib from "../test/server/testlib";
import {LibraryServer} from "./library-server";
import {Library} from "./library";
import {ObjectRole, PersonRelation} from "../common/db";
import {FileSystemStorage} from "./storage";
import {StorageDatabase} from "./storage-db";

async function start(): Promise<void> {
  let libDb = await createTestLib();

  await libDb.addPersonRelation(testlib.MIST, testlib.PERSON1, PersonRelation.Author);

  let lib = new Library(libDb);
  let server = new LibraryServer(lib);

  let storageDb = new StorageDatabase('./demo/organica_lib/storage.db');
  await storageDb.createOrOpen();
  let storage = await FileSystemStorage.load('./demo/organica_lib');
  lib.addStorage(storage);

  await storageDb.registerObject({
    uuid: 'some random uuid',
    location: 'file://location.pdf'
  });

  await storageDb.registerObject({
    uuid: 'another random object',
    location: 'file://location.fb2'
  });

  await libDb.addObjectRelation(testlib.MIST, {
    uuid: 'some random uuid',
    role: ObjectRole.Format,
    tag: 'pdf'
  });

  await libDb.addObjectRelation(testlib.MIST, {
    uuid: 'another random object',
    role: ObjectRole.Format,
    tag: 'fb2'
  });

  return server.start();
}

start().then(() => {
  console.log('Server listening...');
}, (err: Error) => {
  console.log('Error: ' + err.message);
});
