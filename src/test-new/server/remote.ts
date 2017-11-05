import {should, expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Database, Model, SortOrder} from "../../new_server/db";
import {DatabaseServer} from "../../new_server/db-server";
import supertest = require("supertest");

should();
chai.use(chaiAsPromised);

describe("DatabaseServer", function () {
  interface Foo {
    id: number;
    name: string;
  }

  interface Bar {
    id: number;
    title: string;
  }

  let db: Database;
  let fooModel: Model<Foo>, barModel: Model<Bar>;

  beforeEach(async function() {
    db = await Database.open(':memory:', { shouldCreate: true });

    fooModel = await db.define<Foo>('foo', {
      id: { primaryKey: true },
      name: {}
    }, {
      defaultSorting: {
        by: 'name',
        order: SortOrder.Asc
      }
    });

    barModel = await db.define<Bar>('bar', {
      id: { primaryKey: true },
      name: {}
    });

    await db.flushSchema();

    await fooModel.build({ id: 1, name: 'first' }).$flush();
    await fooModel.build({ id: 2, name: 'second' }).$flush();
    await fooModel.build({ id: 3, name: 'third' }).$flush();
  });

  it("create server", async function () {
    let server = new DatabaseServer(db, 9999);
    expect(server.port).to.equal(9999);
    expect(server.server).to.not.be.null;
    await server.start();
    await server.stop();
  });

  describe("server access", function () {
    let server: DatabaseServer;

    beforeEach(async function() {
      server = new DatabaseServer(db, 9999);
      await server.start();
    });

    afterEach(async function() {
      await server.stop();
    });

    it("list items", function (done) {
      supertest(server.server)
          .get('/foo')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              errors: null,
              data: {
                totalCount: null,
                items: [
                  { id: 1, name: 'first' },
                  { id: 2, name: 'second' },
                  { id: 3, name: 'third' }
                ]
              }
            });
          }).end(done);
    });

    it("list items with sorting", function (done) {
      supertest(server.server)
          .get('/foo?sort=-id')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              errors: null,
              data: {
                totalCount: null,
                items: [
                  { id: 3, name: 'third' },
                  { id: 2, name: 'second' },
                  { id: 1, name: 'first' }
                ]
              }
            });
          })
          .end(done);
    });

    it("list items with default sorting", function (done) {
      supertest(server.server)
          .get('/foo?sort=-')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              errors: null,
              data: {
                totalCount: null,
                items: [
                  { id: 3, name: 'third' },
                  { id: 2, name: 'second' },
                  { id: 1, name: 'first' }
                ]
              }
            });
          })
          .end(done);
    });
  });
});
