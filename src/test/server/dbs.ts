import {should, expect} from 'chai';
import {ConfigOption, StorageDatabase} from '../../server/storage-db';
import * as tmp from 'tmp';
import * as chai from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import {DatabaseWithOptions} from "../../server/db";
import {GroupType, KnownGroupTypes, LibraryDatabase} from "../../server/library-db";

should();
chai.use(chaiAsPromised);

const TEST_UUID = '783ce831-c448-4f7a-ada1-b704e3d064b4';
const TEST_UUID2 = '63e93897-4aa7-4e09-8472-09b9b46507b3';
const TEST_UUID3 = 'c17aa4e4-f36e-42b1-9026-70d9c0457b75';

const TEST_VERSION = 42;

describe("DatabaseWithOptions", function() {
  let tmpFile: tmp.SynchrounousResult;

  beforeEach(() => {
    tmpFile = tmp.fileSync();
  });

  describe("create/open", function() {
    it("should create db and load existing one", async function() {
      let db = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      await db.create();

      expect(db.filename).to.be.equal(tmpFile.name);
      expect(db.getOption("uuid")).not.to.be.null;

      let loadingDb = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      await loadingDb.open();

      expect(loadingDb.getOption("uuid")).to.be.equal(db.getOption("uuid"));
      expect(loadingDb.filename).to.be.equal(tmpFile.name);
    });

    it('should not allow call open/create on same database twice', async function() {
      let db = new DatabaseWithOptions(":memory:", TEST_VERSION);
      await db.create();

      return expect(db.create()).to.be.rejected;
    });

    it('should not open non-existent database', function() {
      let db = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      return expect(db.open()).to.be.rejected;
    });

    it('should not create already existing database', async function() {
      let db = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      await db.create();

      let anotherDb = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      return expect(anotherDb.create()).to.be.rejected;
    });

    it('new uuid for storage should be created', async function() {
      let db = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      await db.create();

      expect(db.getOption(ConfigOption.Uuid)).to.not.be.null;
    });
  });

  describe("getOption/setOption", function() {
    let db: DatabaseWithOptions;

    beforeEach(function() {
      db = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      return db.create();
    });

    it("get/set", async function() {
      await db.setOption('test', 'test value');
      expect(db.getOption('test')).to.be.equal('test value');
    });

    it('option names should be case-insensitive', async function() {
      await db.setOption('test', 'test value');
      expect(db.getOption("Test")).to.be.equal("test value");
    });

    it('options should be loaded again', async function() {
      await db.setOption('test', 'test value');
      let loadingDb = new DatabaseWithOptions(tmpFile.name, TEST_VERSION);
      await loadingDb.open();
      expect(loadingDb.getOption('Test')).to.be.equal('test value');
    });

    it('options that not exists should be null', function() {
      expect(db.getOption('nonexistent')).to.be.null;
    });
  });
});

describe("StorageDatabase", function() {
  describe("objects manipulation", function() {
    let storage: StorageDatabase;

    beforeEach(() => {
      storage = new StorageDatabase(":memory:");
      return storage.create();
    });

    it('object should be registered without errors', async function() {
      let obj = await storage.registerObject({ uuid: null, location: '/path/to/fake/location' });
      expect(obj.uuid).to.not.be.null;
      expect(obj.location).to.be.equal('/path/to/fake/location');
    });

    it('object uuid should not be changed if specified', async function() {
      let obj = await storage.registerObject({uuid: TEST_UUID, location: '/path/to/fake/location' });
      expect(obj.uuid).to.be.equal(TEST_UUID);
    });

    it('object should not be accessible without registering', function() {
      storage.getObject(TEST_UUID).should.eventually.be.null;
    });

    it('object should be accessible after registering', async function() {
      await storage.registerObject({ uuid: TEST_UUID, location: '/path/to/fake/location' });
      let obj = await storage.getObject(TEST_UUID);
      expect(obj).not.to.be.null;
      if (obj != null) {
        expect(obj.uuid).to.be.equal(TEST_UUID);
        expect(obj.location).to.be.equal('/path/to/fake/location');
      }
    });

    it('duplicates should not be allowed', async function() {
      await storage.registerObject({ uuid: TEST_UUID, location: '/path/to/fake/location' });
      return storage.registerObject({ uuid: TEST_UUID, location: '/another/path' }).should.be.rejected;
    });

    it('empty location should not be allowed', function() {
      return storage.registerObject({ uuid: null, location: '' }).should.be.rejected;
    });
  });

  describe('updateObject/unregisterObject', function() {
    let storage: StorageDatabase;

    beforeEach(async function() {
      storage = new StorageDatabase(':memory:');
      await storage.create();

      return Promise.all([
          storage.registerObject({ uuid: TEST_UUID, location: '/location/1/ '}),
          storage.registerObject({ uuid: TEST_UUID2, location: '/location/2/'})
      ]);
    });

    it('should update an object', async function() {
      let obj = await storage.updateObject({ uuid: TEST_UUID2, location: '/new/location'} );
      expect(obj).to.have.property('location', '/new/location');

      let dbObj = await storage.getObject(TEST_UUID2);
      expect(dbObj).to.have.property('uuid', TEST_UUID2);
      expect(dbObj).to.have.property('location', '/new/location');
    });

    it('should not update a non-existent object', function() {
      return expect(storage.updateObject({ uuid: TEST_UUID3, location: '/new/location' })).to.be.rejected;
    });

    it('should unregister an object', function() {
      return storage.unregisterObject(TEST_UUID2).should.be.fulfilled;
    });

    it('unreigstered object should be accessible after', async function() {
      await storage.unregisterObject(TEST_UUID2);
      return storage.getObject(TEST_UUID2).should.eventually.be.null;
    });

    it('should fail when unregistering non-existent object', function() {
      return storage.unregisterObject(TEST_UUID3).should.be.rejected;
    });
  });
});

describe("LibraryDatabase", function () {
  describe("Group types initialization", function () {
    it("should add known group types", async function () {
      let db = new LibraryDatabase(':memory:');
      await db.create();

      let gt = db.getGroupType(KnownGroupTypes.Tags);
      expect(gt).not.to.be.null;
      if (gt != null) {
        expect(gt.uuid).to.be.equal(KnownGroupTypes.Tags);
      }
    });
  });

  describe("Group types", function () {
    let db: LibraryDatabase;

    beforeEach(function () {
      db = new LibraryDatabase(':memory:');
      return db.create();
    });

    it("should add group types", async function () {
      let newType = await db.addGroupType({ uuid: null, name: 'custom group type', indexable: false, exclusive: true });
      expect(newType.uuid).to.not.be.null;
      expect(newType.name).to.be.equal('custom group type');
      expect(newType.indexable).to.be.false;
      expect(newType.exclusive).to.be.true;
    });

    it("should remove group types", async function () {
      expect(db.getGroupType(KnownGroupTypes.Languages)).to.not.be.null;
      await db.removeGroupType(KnownGroupTypes.Languages);
      expect(db.getGroupType(KnownGroupTypes.Languages)).to.be.null;
    });

    it("should not allow removing nonexistent group types", async function () {
      expect(db.getGroupType(TEST_UUID2)).to.be.null;
      await db.removeGroupType(TEST_UUID2).should.be.rejected;
      expect(db.getGroupType(TEST_UUID2)).to.be.null;
    });

    it("should update types", async function () {
      let oldType = db.getGroupType(KnownGroupTypes.Tags);
      expect(oldType).to.have.property('name', 'tags');

      let modType = await db.updateGroupType({ uuid: KnownGroupTypes.Tags, name: 'new name for tags',
              indexable: true, exclusive: true });
      expect(modType.uuid).to.be.equal(KnownGroupTypes.Tags);
      expect(modType.name).to.be.equal('new name for tags');

      expect(oldType).to.have.property('name', 'tags');
      expect(oldType).to.have.property('uuid', KnownGroupTypes.Tags);

      let retType = db.getGroupType(KnownGroupTypes.Tags);
      expect(retType).to.have.property('uuid', KnownGroupTypes.Tags);
      expect(retType).to.have.property('name', 'new name for tags');
    });
  });

  describe("Persons", function () {
    let db: LibraryDatabase;

    beforeEach(async function () {
      db = new LibraryDatabase(':memory:');
      await db.create();
    });

    it("should not get nonexistent persons", function () {
      return db.getPerson(TEST_UUID2).should.eventually.be.null;
    });

    it("should add persons", async function () {
      let person = await db.addPerson({
        uuid: null,
        name: 'Mark Twain',
        nameSort: 'Twain, Mark'
      });

      expect(person.uuid).not.to.be.null;
      expect(person.name).to.be.equal('Mark Twain');
      expect(person.nameSort).to.be.equal('Twain, Mark');

      if (person.uuid != null) {
        let getPerson = await db.getPerson(person.uuid);

        expect(getPerson).not.to.be.null;
        if (getPerson != null) {
          expect(getPerson.uuid).to.be.equal(person.uuid);
          expect(getPerson.name).to.be.equal('Mark Twain');
          expect(getPerson.nameSort).to.be.equal('Twain, Mark');
        }
      }
    });

    describe("More persons", function () {
      beforeEach(async function () {
        await db.addPerson({
          uuid: TEST_UUID,
          name: 'Mark Twain',
          nameSort: 'Twain, Mark'
        });

        await db.addPerson({
          uuid: TEST_UUID2,
          name: 'Stephen King',
          nameSort: 'King, Stephen'
        });

        await db.addPerson({
          uuid: TEST_UUID3,
          name: 'Fyodor Dostoevsky',
          nameSort: 'Dostoevsky, Fyodor'
        });
      });

      it("should remove persons", async function () {
        await db.getPerson(TEST_UUID2).should.eventually.be.not.null;

        await db.removePerson(TEST_UUID2);

        return db.getPerson(TEST_UUID2).should.eventually.be.null;
      });

      it("should update persons", async function () {
        let person = await db.getPerson(TEST_UUID2);
        expect(person).not.to.be.null;
        if (person != null) {
          expect(person.uuid).to.be.equal(TEST_UUID2);
          expect(person.name).to.be.equal('Stephen King');
        }

        let updPerson = await db.updatePerson({
          uuid: TEST_UUID2,
          name: 'King of Horrors',
          nameSort: 'Horrors of King'
        });

        expect(updPerson).not.to.be.null;
        if (updPerson != null) {
          expect(updPerson.name).to.be.equal('King of Horrors');
          expect(updPerson.nameSort).to.be.equal('Horrors of King');
        }

        let getPerson = await db.getPerson(TEST_UUID2);
        expect(getPerson).not.to.be.null;
        if (getPerson != null) {
          expect(getPerson.name).to.be.equal('King of Horrors');
          expect(getPerson.nameSort).to.be.equal('Horrors of King');
        }
      });
    });
  });
});
