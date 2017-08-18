import { should, expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as testlib from './testlib';
import {LibraryDatabase, PersonRelation} from "../../server/library-db";
import * as sinon from "sinon";
import {LibraryServer} from "../../server/library-server";
import {Library} from "../../server/library";

should();
chai.use(chaiAsPromised);

describe("LibraryServer", function () {
  let server: LibraryServer;
  let libDb: LibraryDatabase;
  let lib: Library;
  let clock: sinon.SinonFakeTimers;

  beforeEach(async function() {
    clock = sinon.useFakeTimers();
    clock.tick(10000);

    libDb = await testlib.createTestLib();lib
    lib = new Library(libDb);
    server = new LibraryServer(lib);
  });

  afterEach(async function() {
    clock.restore();
  });

  it("should list all resources", async function () {
    let resp = await server.handle('/resources/');
    expect(resp.errors).to.have.lengthOf(0);
    expect(resp.data).to.have.lengthOf(testlib.RES_COUNT);
  });

  it("should list all authors", async function () {
    let resp = await server.handle('/authors/');
    expect(resp.errors).to.have.lengthOf(0);
    expect(resp.data).to.have.lengthOf(testlib.AUTHORS_COUNT);
  });

  it("should list all tags", async function () {
    let resp = await server.handle('/tags/');
    expect(resp.errors).to.have.lengthOf(0);
    expect(resp.data).to.have.lengthOf(testlib.TAG_COUNT);
  });

  it("should show props of a single resource", async function () {
    let resp = await server.handle('/resources/' + testlib.MIST);
    expect(resp.errors).to.have.lengthOf(0);
    expect(resp.data).to.be.deep.equal({
      id: testlib.MIST,
      type: 'resource',
      title: "The Mist",
      titleSort: "Mist, The",
      rating: 400,
      addDate: new Date(),
      lastModifyDate: new Date(),
      publishDate: "1980",
      publisher: "Viking Press",
      desc: "The Mist is a horror novella by the American author Stephen King, in which the small town of Bridgton, Maine is suddenly enveloped in an unnatural mist that conceals otherworldly monsters."
    });
  });

  it("should list related persons", async function () {
    let resp = await server.handle(`/resources/${testlib.MIST}/authors`);
    expect(resp.errors).to.have.lengthOf(0);
    expect(resp.data).to.be.deep.equal({
      id: testlib.KING,
      type: 'person',
      name: 'Stephen King',
      nameSort: 'King, Stephen',
      relation: PersonRelation.Author,
    });
  });
});
