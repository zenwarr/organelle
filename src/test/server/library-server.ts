import { should, expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as testlib from './testlib';
import {LibraryDatabase, PersonRelation} from "../../server/library-db";
import * as sinon from "sinon";
import {LibraryServer} from "../../server/library-server";
import {Library} from "../../server/library";
import * as supertest from 'supertest';

should();
chai.use(chaiAsPromised);

describe("LibraryServer", function () {
  let server: LibraryServer;
  let libDb: LibraryDatabase;
  let lib: Library;
  let fakeDate: Date;

  beforeEach(async function() {
    let clock = sinon.useFakeTimers();
    clock.tick(10000);
    fakeDate = new Date();

    try {
      libDb = await testlib.createTestLib();
    } finally {
      clock.restore();
    }

    lib = new Library(libDb);
    server = new LibraryServer(lib);
    await server.start();
  });

  afterEach(async function() {
    await server.stop();
  });

  it("should return an error when path is invalid", function (done) {
    supertest(server.server)
        .get('/invalid/')
        .expect(404)
        .end(done);
  });

  it("should list all resources", function (done) {
    supertest(server.server)
        .get('/resources/')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.RES_COUNT);
        })
        .end(done);
  });

  it("should list all authors", function (done) {
    supertest(server.server)
        .get('/authors/')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.AUTHORS_COUNT);
        })
        .end(done);
  });

  it("should list all tags", function (done) {
    supertest(server.server)
        .get('/tags')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.TAG_COUNT);
        })
        .end(done);
  });

  it("should show props of a single resource", function (done) {
    supertest(server.server)
        .get('/resources/' + testlib.MIST)
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal({
            uuid: testlib.MIST,
            type: 'resource',
            title: 'The Mist',
            titleSort: 'Mist, The',
            rating: 400,
            addDate: fakeDate.toUTCString(),
            lastModifyDate: fakeDate.toUTCString(),
            publisher: 'Viking Press',
            publishDate: '1980',
            desc: "The Mist is a horror novella by the American author Stephen King, in which the small town of Bridgton, Maine is suddenly enveloped in an unnatural mist that conceals otherworldly monsters."
          });
        })
        .end(done);
  });

  it("should return 404 when resource does not exist", function (done) {
    supertest(server.server)
        .get('/resources/not_exist')
        .expect(404)
        .end(done);
  });

  it("should list related persons", function (done) {
    supertest(server.server)
        .get(`/resources/${testlib.MIST}/persons`)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal([
            {
              uuid: testlib.KING,
              type: 'related_person',
              name: 'Stephen King',
              nameSort: 'King, Stephen',
              relation: 'author'
            }
          ]);
        })
        .end(done);
  });
});
