import { expect } from 'chai';
import {CollationNoCase, Database, TypeHint} from "../../new_server/db";

describe('Database', function() {
  describe('createSchema', function() {
    let db: Database;

    beforeEach(function() {
      db = new Database();
    });

    it("should create a simple schema", function () {
      db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true }
      });
      expect(db.createSchema()).to.be.equal('CREATE TABLE foo(id INTEGER PRIMARY KEY)');
    });

    it("should create a schema with two columns", function () {
      db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true },
        someColumn: { typeHint: TypeHint.Text, collation: CollationNoCase, defaultValue: '' }
      });
      expect(db.createSchema())
          .to.be.equal('CREATE TABLE foo(id INTEGER PRIMARY KEY, someColumn TEXT COLLATE NOCASE DEFAULT "")');
    });

    it("should add fields after define", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true }
      });
      fooModel.addField('someColumn', { typeHint: TypeHint.Text });
      expect(db.createSchema())
          .to.be.equal('CREATE TABLE foo(id INTEGER PRIMARY KEY, someColumn TEXT)');
    });

    it("should throw on adding field with already reserved name", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true }
      });
      fooModel.addField('someColumn', { typeHint: TypeHint.Text });
      expect(() => fooModel.addField('someColumn', { typeHint: TypeHint.Text })).to.throw();
    });

    it("should update fields", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer }
      });
      fooModel.updateField('id', { primaryKey: true });
      expect(db.createSchema()).to.be.equal('CREATE TABLE foo(id INTEGER PRIMARY KEY)');
    });

    it("should create one-to-one association", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer }
      });

      let barModel = db.define('bar', {
        barId: { typeHint: TypeHint.Integer }
      });
      barModel.oneToOne(fooModel, 'fooId', 'id');

      expect(db.createSchema()).to.be
          .equal('CREATE TABLE foo(id INTEGER); CREATE TABLE bar(barId INTEGER, fooId INTEGER, FOREIGN KEY (fooId) REFERENCES foo(id))')
    });

    it("should automatically find a primary key to link to", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true }
      });

      let barModel = db.define('bar', {
        barId: { typeHint: TypeHint.Integer }
      });
      barModel.oneToOne(fooModel, 'fooId');

      expect(db.createSchema()).to.be
          .equal('CREATE TABLE foo(id INTEGER PRIMARY KEY); CREATE TABLE bar(barId INTEGER, fooId INTEGER, FOREIGN KEY (fooId) REFERENCES foo(id))');
    });

    it("should create a compound primary key", function () {
      let fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true },
        id2: { typeHint: TypeHint.Integer, primaryKey: true }
      });

      expect(db.createSchema()).to.be
          .equal('CREATE TABLE foo(id INTEGER, id2 INTEGER, PRIMARY KEY(id, id2))')
    });
  });
});
