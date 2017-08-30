import { should, expect } from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as testlib from './testlib';
import {LibraryDatabase} from "../../server/library-db";
import * as sinon from "sinon";
import {LibraryServer} from "../../server/library-server";
import {Library} from "../../server/library";
import * as supertest from 'supertest';
import {OBJ1, StorageMock} from "./storage-mock";
import {KnownGroupTypes, ObjectRole, PersonRelation} from "../../common/db";

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

  it("should support pagination of resources", function (done) {
    supertest(server.server)
        .get('/resources?offset=1&count=3')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(3);
        })
        .end(done);
  });

  it("should support sorting resources", function (done) {
    supertest(server.server)
        .get('/resources?sort=+titleSort')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.RES_COUNT);
          expect(resp.body[0].uuid).to.be.equal(testlib.WAR);
        })
        .end(done);
  });

  it("should support sorting resource in reverse order", function (done) {
    supertest(server.server)
        .get('/resources?sort=-titleSort')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.RES_COUNT);
          expect(resp.body[0].uuid).to.be.equal(testlib.ULYSSES);
        })
        .end(done);
  });

  it("should support default sorting", function (done) {
    supertest(server.server)
        .get('/resources?sort=-')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.have.lengthOf(testlib.RES_COUNT);
          expect(resp.body[0].uuid).to.be.equal(testlib.ULYSSES);
        })
        .end(done);
  });

  it("should show props of a single resource", function (done) {
    supertest(server.server)
        .get('/resource/' + testlib.MIST)
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
            desc: "The Mist is a horror novella by the American author Stephen King, in which the small town of Bridgton, Maine is suddenly enveloped in an unnatural mist that conceals otherworldly monsters.",
            relatedObjects: [],
            relatedPersons: [{
              name: 'Stephen King',
              nameSort: 'King, Stephen',
              relation: PersonRelation.Author,
              type: 'related_person',
              uuid: testlib.KING
            }],
            relatedGroups: []
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
        .get(`/resource/${testlib.MIST}/persons`)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal([
            {
              uuid: testlib.KING,
              type: 'related_person',
              name: 'Stephen King',
              nameSort: 'King, Stephen',
              relation: PersonRelation.Author
            }
          ]);
        })
        .end(done);
  });

  it("should list related persons of a specific relation", function (done) {
    Promise.all([
      libDb.addPersonRelation(testlib.MIST, testlib.PERSON2, PersonRelation.Editor),
      libDb.addPersonRelation(testlib.MIST, testlib.PERSON3, PersonRelation.Translator),
      libDb.addPersonRelation(testlib.MOCKINGBIRD, testlib.LEE, PersonRelation.Author),
    ]).then(() => {
      supertest(server.server)
          .get(`/resource/${testlib.MIST}/persons/author,editor`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.KING, testlib.PERSON2])
          })
          .end(done);
    });
  });

  it("should list related groups for a resource", function (done) {
    Promise.all([
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.TAG1),
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.CATEGORY2),
      libDb.addGroupRelation(testlib.ULYSSES, testlib.LANG_ENGLISH)
    ]).then(() => {
      supertest(server.server)
          .get(`/resource/${testlib.MOCKINGBIRD}/groups`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.CATEGORY2, testlib.TAG1]);
          })
          .end(done);
    });
  });

  it("should list related groups of a specific types", function (done) {
    Promise.all([
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.TAG1),
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.TAG2),
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.CATEGORY2),
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.LANG_ENGLISH),
      libDb.addGroupRelation(testlib.ULYSSES, testlib.LANG_ENGLISH)
    ]).then(() => {
      supertest(server.server)
          .get(`/resource/${testlib.MOCKINGBIRD}/groups/tags,langs`)
          // .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.LANG_ENGLISH, testlib.TAG1, testlib.TAG2]);
          })
          .end(done);
    });
  });

  describe("objects", function () {
    const OBJ1 = '1uuid',
        OBJ2 = '2uuid',
        OBJ3 = '3uuid',
        OBJ4 = '4uuid';

    beforeEach(async function() {
      return Promise.all([
        libDb.addObjectRelation(testlib.MIST, {
          uuid: OBJ1,
          role: ObjectRole.Format,
          tag: 'pdf'
        }),
        libDb.addObjectRelation(testlib.MIST, {
          uuid: OBJ2,
          role: ObjectRole.Format,
          tag: 'djvu'
        }),
        libDb.addObjectRelation(testlib.MIST, {
          uuid: OBJ3,
          role: ObjectRole.Format,
          tag: 'pdf'
        }),
        libDb.addObjectRelation(testlib.MOCKINGBIRD, {
          uuid: OBJ4,
          role: ObjectRole.Format,
          tag: 'fb2'
        })
      ]);
    });

    it("should list related objects", function (done) {
      supertest(server.server)
          .get(`/resource/${testlib.MIST}/objects/pdf`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([OBJ1, OBJ3]);
          })
          .end(done);
    });

    it("should list objects of specific roles", function (done) {
      supertest(server.server)
          .get(`/resource/${testlib.MOCKINGBIRD}/objects/roles/format`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([OBJ4]);
          })
          .end(done);
    });

    it("should list objects of specific role and tag", function (done) {
      supertest(server.server)
          .get(`/resource/${testlib.MIST}/objects/djvu/roles/format`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([OBJ2]);
          })
          .end(done);
    });

    it("should list all objects", function (done) {
      supertest(server.server)
          .get(`/objects/`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([OBJ2, OBJ4, OBJ1, OBJ3]);
          })
          .end(done);
    });

    it("should list objects with specific tag", function (done) {
      supertest(server.server)
          .get('/objects/tags/pdf')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([OBJ1, OBJ3]);
          })
          .end(done);
    });

    it("should list object tags", function (done) {
      supertest(server.server)
          .get('/objects/tags/')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.tag)).to.be.deep.equal(['djvu', 'fb2', 'pdf']);
          })
          .end(done);
    });

    it("should list objects inside full resource props", function (done) {
      supertest(server.server)
          .get(`/resource/${testlib.MIST}`)
          // .expect(200)
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
              desc: "The Mist is a horror novella by the American author Stephen King, in which the small town of Bridgton, Maine is suddenly enveloped in an unnatural mist that conceals otherworldly monsters.",
              relatedObjects: [{
                location: null,
                role: ObjectRole.Format,
                tag: "djvu",
                type: "related_object",
                uuid: "2uuid"
              },
              {
                location: null,
                role: ObjectRole.Format,
                tag: "pdf",
                type: "related_object",
                uuid: "1uuid"
              },
              {
                location: null,
                role: ObjectRole.Format,
                tag: "pdf",
                type: "related_object",
                uuid: "3uuid"
              }],
              relatedPersons: [{
                name: 'Stephen King',
                nameSort: 'King, Stephen',
                type: 'related_person',
                relation: PersonRelation.Author,
                uuid: testlib.KING
              }],
              relatedGroups: []
            });
          })
          .end(done);
    });
  });

  it("should list groups", function (done) {
    supertest(server.server)
        .get('/groups')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.SERIES1, testlib.LANG_ENGLISH, testlib.CATEGORY1,
              testlib.CATEGORY2, testlib.LANG_RUSSIAN, testlib.TAG1, testlib.TAG2]);
        })
        .end(done);
  });

  it("should list groups with specific type", function (done) {
    supertest(server.server)
        .get('/groups/types/langs')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.LANG_ENGLISH, testlib.LANG_RUSSIAN]);
        })
        .end(done);
  });

  it("should get properties of a single group", function (done) {
    supertest(server.server)
        .get('/group/' + testlib.LANG_ENGLISH)
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal({
            uuid: testlib.LANG_ENGLISH,
            type: 'group',
            title: 'english',
            titleSort: 'english',
            groupType: {
              exclusive: false,
              name: 'langs',
              ordered: false,
              uuid: KnownGroupTypes.Language
            }
          });
        })
        .end(done);
  });

  it("should list resources inside a group", function (done) {
    Promise.all([
        libDb.addGroupRelation(testlib.MIST, testlib.LANG_ENGLISH),
        libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.LANG_ENGLISH),
        libDb.addGroupRelation(testlib.CRIME, testlib.LANG_RUSSIAN)
    ]).then(() => {
      supertest(server.server)
          .get(`/group/${testlib.LANG_ENGLISH}/resources`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.MOCKINGBIRD, testlib.MIST])
          })
          .end(done);
    });
  });

  it("should list resources inside groups of specified group type", function (done) {
    Promise.all([
      libDb.addGroupRelation(testlib.MIST, testlib.LANG_ENGLISH),
      libDb.addGroupRelation(testlib.MOCKINGBIRD, testlib.LANG_ENGLISH),
      libDb.addGroupRelation(testlib.CRIME, testlib.LANG_RUSSIAN),
      libDb.addGroupRelation(testlib.ULYSSES, testlib.TAG1)
    ]).then(() => {
      supertest(server.server)
          .get(`/groups/types/langs/resources`)
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.CRIME, testlib.MOCKINGBIRD, testlib.MIST]);
          })
          .end(done);
    })
  });

  it("should list persons", function (done) {
    supertest(server.server)
        .get('/persons')
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.HEMINGWAY, testlib.KING, testlib.LEE,
                  testlib.PERSON1, testlib.PERSON2, testlib.PERSON3]);
        })
        .end(done);
  });

  it("should list persons with specific relation", function (done) {
    Promise.all([
        libDb.addPersonRelation(testlib.ULYSSES, testlib.PERSON1, PersonRelation.Editor),
        libDb.addPersonRelation(testlib.CRIME, testlib.PERSON2, PersonRelation.Editor)
    ]).then(() => {
      supertest(server.server)
          .get('/persons/relations/editor')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.PERSON1, testlib.PERSON2]);
          })
          .end(done);
    });
  });

  it("should list resources related to a person", function (done) {
    Promise.all([
        libDb.addPersonRelation(testlib.MOCKINGBIRD, testlib.LEE, PersonRelation.Author),
        libDb.addPersonRelation(testlib.ULYSSES, testlib.PERSON1, PersonRelation.Editor)
    ]).then(() => {
      supertest(server.server)
          .get('/persons/relations/author/resources')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.MOCKINGBIRD, testlib.MIST]);
          })
          .end(done);
    });
  });

  it("should show properties of a single person", function (done) {
    supertest(server.server)
        .get(`/person/${testlib.KING}/`)
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal({
            uuid: testlib.KING,
            type: 'person',
            name: 'Stephen King',
            nameSort: 'King, Stephen'
          });
        })
        .end(done);
  });

  it("should list resources for a single person", function (done) {
    supertest(server.server)
        .get(`/person/${testlib.KING}/resources/`)
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body.map((x: any) => x.uuid)).to.be.deep.equal([testlib.MIST]);
        })
        .end(done);
  });

  it("should show resolved objects", function (done) {
    lib.addStorage(new StorageMock());

    supertest(server.server)
        .get(`/locations/${OBJ1}`)
        .expect(200)
        .expect((resp: any) => {
          expect(resp.body).to.be.deep.equal([
            { type: 'object_location', location: 'organelle://loc1' },
            { type: 'object_location', location: 'organelle://loc2' }
          ]);
        })
        .end(done);
  });
});
