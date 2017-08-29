import {createTestLib} from "../test/server/testlib";
import {LibraryServer} from "./library-server";
import {Library} from "./library";

async function start(): Promise<void> {
  let libDb = await createTestLib();
  let lib = new Library(libDb);
  let server = new LibraryServer(lib);

  return server.start();
}

start().then(() => {
  console.log('Server listening...');
}, (err: Error) => {
  console.log('Error: ' + err.message);
});
