import {should, expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Database, Model, MultiRelation, SingleRelation, SortOrder, TypeHint} from "../../new_server/db";
import {DatabaseServer} from "../../new_server/db-server";
import supertest = require("supertest");

should();
chai.use(chaiAsPromised);

describe("DatabaseServer", function () {
  interface Foo {
    id: number;
    name: string;
    bars: MultiRelation<Foo, Bar>;
  }

  interface Bar {
    id: number;
    title: string;
  }

  interface Baz {
    id: number;
    bar: SingleRelation<Baz, Bar>;
  }

  let db: Database;
  let fooModel: Model<Foo>, barModel: Model<Bar>, bazModel: Model<Baz>;

  beforeEach(async function() {
    db = await Database.open(':memory:', { shouldCreate: true });

    fooModel = await db.define<Foo>('foo', {
      id: { primaryKey: true, typeHint: TypeHint.Integer },
      name: { typeHint: TypeHint.Text }
    }, {
      defaultSorting: {
        by: 'name',
        order: SortOrder.Asc
      }
    });

    barModel = await db.define<Bar>('bar', {
      id: { primaryKey: true, typeHint: TypeHint.Integer },
      name: { typeHint: TypeHint.Text }
    });

    bazModel = await db.define<Baz>('baz', {
      id: { primaryKey: true, typeHint: TypeHint.Integer }
    });

    fooModel.manyToMany(barModel, 'bars');
    bazModel.oneToOne(barModel, 'bar');

    await db.flushSchema();

    await fooModel.build({ id: 1, name: 'first' }).$flush();
    await fooModel.build({ id: 2, name: 'second' }).$flush();
    await fooModel.build({ id: 3, name: 'third' }).$flush();

    await barModel.build({ id: 10, name: 'bar_1' }).$flush();
    await barModel.build({ id: 20, name: 'bar_2' }).$flush();
    await barModel.build({ id: 30, name: 'bar_3' }).$flush();

    await bazModel.build({ id: 100 }).$flush();

    await (await fooModel.findByPKChecked(2)).bars.linkByPK(10);
    await (await fooModel.findByPKChecked(2)).bars.linkByPK(20);
    await (await bazModel.findByPKChecked(100)).bar.linkByPK(30);
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
              data: {
                items: [
                  { id: 1, name: 'first' },
                  { id: 2, name: 'second' },
                  { id: 3, name: 'third' }
                ]
              }
            });
          }).end(done);
    });

    it("non-existent model", function (done) {
      supertest(server.server)
          .get('/not-a-model')
          .expect(404)
          .end(done);
    });

    it("list items with sorting", function (done) {
      supertest(server.server)
          .get('/foo?sort=-id')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
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
              data: {
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

    it("searching items", function (done) {
      supertest(server.server)
          .get('/foo?filter.name=second')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                items: [
                  { id: 2, name: 'second' }
                ]
              }
            });
          })
          .end(done);
    });

    it("searching with a complex query", function (done) {
      supertest(server.server)
          .get('/foo?filter.id.$gte=2')
          .expect(200)
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                items: [
                  { id: 2, name: 'second' },
                  { id: 3, name: 'third' }
                ]
              }
            });
          })
          .end(done);
    });

    it("counting", function (done) {
      supertest(server.server)
          .get('/foo?fetchTotalCount=1&includeItems=0')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                totalCount: 3
              }
            })
          })
          .end(done);
    });

    it("fetching information about a single item", function (done) {
      supertest(server.server)
          .get('/foo/1')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                id: 1,
                name: 'first'
              }
            })
          })
          .end(done);
    });

    it("fetching related items", function (done) {
      supertest(server.server)
          .get('/foo/2/bars')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                items: [
                  { id: 10, name: 'bar_1' },
                  { id: 20, name: 'bar_2' }
                ]
              }
            })
          })
          .end(done);
    });

    it("fetching related items count", function (done) {
      supertest(server.server)
          .get('/foo/2/bars?fetchTotalCount=1&includeItems=0')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                totalCount: 2
              }
            })
          })
          .end(done);
    });

    it("fetch an item with foreign keys should not fetch the foreign key itself", function (done) {
      supertest(server.server)
          .get('/baz/100')
          .expect((resp: any) => {
            expect(resp.body).to.be.deep.equal({
              data: {
                id: 100
              }
            })
          })
          .end(done);
    });
  });
});
