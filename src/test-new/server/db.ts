import { expect } from 'chai';
import {CollationNoCase, Database, Model, TypeHint} from "../../new_server/db";
import uuid = require("uuid");

describe('Database', function() {
  describe('createSchema', function() {
    let db: Database;

    beforeEach(async function() {
      db = await Database.open(':memory:');
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
          .equal('CREATE TABLE foo(id INTEGER); CREATE TABLE bar(barId INTEGER, fooId INTEGER UNIQUE, FOREIGN KEY (fooId) REFERENCES foo(id))')
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
          .equal('CREATE TABLE foo(id INTEGER PRIMARY KEY); CREATE TABLE bar(barId INTEGER, fooId INTEGER UNIQUE, FOREIGN KEY (fooId) REFERENCES foo(id))');
    });

    it("should create one-to-many association", function () {
      let fooModel = db.define('foo', {
        fooId: { typeHint: TypeHint.Integer }
      });

      let barModel = db.define('bar', {
        barId: { typeHint: TypeHint.Integer, primaryKey: true }
      });
      barModel.oneToMany(fooModel, 'barId');

      expect(db.createSchema()).to.be
          .equal('CREATE TABLE foo(fooId INTEGER, barId INTEGER UNIQUE, FOREIGN KEY (barId) REFERENCES bar(barId)); CREATE TABLE bar(barId INTEGER PRIMARY KEY)');
    });

    it("should create many-to-many association", function () {
      let fooModel = db.define('foo', {
        fooId: { typeHint: TypeHint.Integer, primaryKey: true }
      });

      let barModel = db.define('bar', {
        barId: { typeHint: TypeHint.Integer, primaryKey: true }
      });
      barModel.manyToMany(fooModel, 'foobar', 'barId', 'fooId');

      expect(db.createSchema()).to.be
          .equal('CREATE TABLE foo(fooId INTEGER PRIMARY KEY); CREATE TABLE bar(barId INTEGER PRIMARY KEY); CREATE TABLE foobar(barId INTEGER, fooId INTEGER, FOREIGN KEY (barId) REFERENCES bar(barId), FOREIGN KEY (fooId) REFERENCES foo(fooId), UNIQUE(barId, fooId))');
    });

    it("should add timestamps", function () {
      let fooModel = db.define('foo', { }, {
        createTimestamp: true,
        updateTimestamp: true
      });

      expect(db.createSchema()).to.be.equal('CREATE TABLE foo(createdAt DATE, updatedAt DATE)');
    });
  });

  describe("flushSchema", function () {
    it("should flush a simple schema without errors", async function () {
      let db = await Database.open(':memory:');
      db.define('foo', {
        name: { typeHint: TypeHint.Text },
        value: { typeHint: TypeHint.Text }
      });
      await db.flushSchema();
    });
  });

  describe("creating instances", function () {
    let db: Database;
    let fooModel: Model<any>;

    beforeEach(async function() {
      db = await Database.open(':memory:');
      fooModel = db.define('foo', {
        id: { typeHint: TypeHint.Integer, primaryKey: true },
        name: { typeHint: TypeHint.Text, unique: true, allowNull: false },
        value: { typeHint: TypeHint.Text }
      });
    });

    it("should create an instance", async function () {
      await db.flushSchema();

      let obj = fooModel.build({
        name: 'option name',
        value: 'option value'
      });
      expect(obj).to.have.property('name', 'option name');
      expect(obj).to.have.property('value', 'option value');
      expect(obj).to.have.property('id', null);
      expect(obj.$fields).to.have.property('size', 3);
      expect(obj.$db).to.be.equal(db);
      expect(obj.$model).to.be.equal(fooModel);
    });

    it("should flush new instance to the database", async function () {
      await db.flushSchema();

      let obj = fooModel.build({
        name: 'option name',
        value: 'option value'
      });
      await obj.$sync();

      expect(obj.$created).to.be.true;
    });

    it("should generate an uuid", async function () {
      const GENERATED_UUID = uuid.v4();

      fooModel.addField('uuid', {
        typeHint: TypeHint.Text,
        newGenerate: given => given == null ? GENERATED_UUID : given
      });

      await db.flushSchema();

      let obj = fooModel.build({
        name: '',
        value: ''
      });
      expect(obj).to.have.property('uuid', GENERATED_UUID);
      await obj.$sync();
    });
  });

  describe("updating instances", function () {
    let db: Database;
    let fooModel: Model<any>;

    beforeEach(async function() {
      db = await Database.open(':memory:');
      fooModel = db.define('foo', {
        name: { typeHint: TypeHint.Text, unique: true, allowNull: false },
        value: { typeHint: TypeHint.Text }
      });
    });

    it("should update instance without errors", async function () {
      await db.flushSchema();

      let inst1 = fooModel.build({
        name: 'some name',
        value: 'some value'
      });
      await inst1.$sync();

      inst1.$fields.set('name', 'another name');
      await inst1.$sync();
    });

    it("should remove instance without errors", async function () {
      await db.flushSchema();

      let inst = fooModel.build({
        name: 'some name',
        value: 'some value'
      });
      await inst.$sync();

      await inst.$remove();
    });
  });
});
