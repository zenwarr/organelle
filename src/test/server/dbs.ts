import {should, expect} from 'chai';
import {ConfigOption, StorageDatabase} from '../../server/storage-db';
import * as tmp from 'tmp';
import * as chai from 'chai';
import * as chaiAsPromised from "chai-as-promised";
import {DatabaseWithOptions} from "../../server/db";
import {GroupType, KnownGroupTypes, LibraryDatabase, PersonRelation, Resource} from "../../server/library-db";
import uuid = require("uuid");
import {dateToTimestamp} from "../../server/common";
import * as sinon from 'sinon';

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

      let gt = db.getGroupType(KnownGroupTypes.Tag);
      expect(gt).not.to.be.null;
      if (gt != null) {
        expect(gt.uuid).to.be.equal(KnownGroupTypes.Tag);
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
      let newType = await db.addGroupType({ uuid: null, name: 'custom group type', ordered: false, exclusive: true });
      expect(newType.uuid).to.not.be.null;
      expect(newType.name).to.be.equal('custom group type');
      expect(newType.ordered).to.be.false;
      expect(newType.exclusive).to.be.true;
    });

    it("should remove group types", async function () {
      expect(db.getGroupType(KnownGroupTypes.Language)).to.not.be.null;
      await db.removeGroupType(KnownGroupTypes.Language);
      expect(db.getGroupType(KnownGroupTypes.Language)).to.be.null;
    });

    it("should not allow removing nonexistent group types", async function () {
      expect(db.getGroupType(TEST_UUID2)).to.be.null;
      await db.removeGroupType(TEST_UUID2).should.be.rejected;
      expect(db.getGroupType(TEST_UUID2)).to.be.null;
    });

    it("should update types", async function () {
      let oldType = db.getGroupType(KnownGroupTypes.Tag);
      expect(oldType).to.have.property('name', 'tags');

      let modType = await db.updateGroupType({ uuid: KnownGroupTypes.Tag, name: 'new name for tags',
              ordered: true, exclusive: true });
      expect(modType.uuid).to.be.equal(KnownGroupTypes.Tag);
      expect(modType.name).to.be.equal('new name for tags');

      expect(oldType).to.have.property('name', 'tags');
      expect(oldType).to.have.property('uuid', KnownGroupTypes.Tag);

      let retType = db.getGroupType(KnownGroupTypes.Tag);
      expect(retType).to.have.property('uuid', KnownGroupTypes.Tag);
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

  describe("Relations", function () {
    let db: LibraryDatabase;

    beforeEach(async function () {
      // db = new LibraryDatabase(tmp.fileSync().name);
      db = new LibraryDatabase(':memory:');
      await db.create();

      await fillTestData(db);
    });

    it("should add relations between resource and author", async function () {
      await db.addPersonRelation(MIST, KING, PersonRelation.Author);

      let related = await db.relatedPersons(MIST);
      expect(related).to.not.be.null;
      expect(related).to.have.lengthOf(1);
      expect(related[0]).to.not.be.null;
      expect(related[0].uuid).to.be.equal(KING);

      await db.addPersonRelation(TOLL, HEMINGWAY, PersonRelation.Author);

      let related2 = await db.relatedPersons(TOLL);
      expect(related2).to.not.be.null;
      expect(related2).to.have.lengthOf(1);
      expect(related2[0]).to.not.be.null;
      expect(related2[0].uuid).to.be.equal(HEMINGWAY);
    });

    it("should not add duplicate relations", async function () {
      await db.addPersonRelation(MIST, KING, PersonRelation.Author);
      await db.addPersonRelation(MIST, KING, PersonRelation.Editor);
      return db.addPersonRelation(MIST, KING, PersonRelation.Author).should.be.rejected;
    });

    describe("More person relations", function () {
      beforeEach(async function () {
        await db.addPersonRelation(MIST, KING, PersonRelation.Author);
        await db.addPersonRelation(MIST, PERSON1, PersonRelation.Editor);
        await db.addPersonRelation(MIST, PERSON2, PersonRelation.Editor);
        await db.addPersonRelation(MIST, PERSON2, PersonRelation.Translator);
      });

      it("should query relations of specific type", async function () {
        let rel = await db.relatedPersons(MIST, PersonRelation.Translator);
        expect(rel).to.have.lengthOf(1);
        expect(rel[0]).to.have.property('uuid', PERSON2);
      });

      it("should query multiple relations of specific type", async function () {
        let rel = await db.relatedPersons(MIST, PersonRelation.Editor);
        expect(rel).to.have.lengthOf(2);
        expect(rel[0].uuid).to.be.oneOf([PERSON1, PERSON2]);
        expect(rel[1].uuid).to.be.oneOf([PERSON1, PERSON2]);
        expect(rel[0].uuid).to.not.be.equal(rel[1].uuid);
      });

      it("should remove specific relation", async function () {
        let relBefore = await db.relatedPersons(MIST);
        expect(relBefore).to.have.lengthOf(4);

        await db.removePersonRelations(MIST, PERSON2, PersonRelation.Editor);

        let relAfter = await db.relatedPersons(MIST);
        expect(relAfter).to.have.lengthOf(3);
      });
    });

    it("should add relations between resource and group", async function () {
      await db.addGroupRelation(MIST, LANG_RUSSIAN);

      let rel = await db.relatedGroups(MIST);

      expect(rel).to.not.be.null;
      expect(rel).to.have.lengthOf(1);
      expect(rel[0]).to.not.be.null;
      expect(rel[0].uuid).to.be.equal(LANG_RUSSIAN);
    });

    it('should not add two relations between exclusive group types', async function () {
      await db.addGroupRelation(MIST, CATEGORY1);
      return db.addGroupRelation(MIST, CATEGORY2).should.be.rejected;
    });

    it("should not add duplicate relations even for non-exclusive types", async function () {
      await db.addGroupRelation(MIST, TAG1);
      return db.addGroupRelation(MIST, TAG1).should.be.rejected;
    });

    it("should not add group index to non-ordered groups", async function () {
      db.addGroupRelation(MIST, TAG1, 10).should.be.rejected;
    });

    it("should not add a relation to non-existent group", async function () {
      db.addGroupRelation(MIST, TEST_UUID2).should.be.rejected;
    });

    it("should remove group relations", async function () {
      await db.addGroupRelation(MIST, LANG_ENGLISH);
      expect(await db.relatedGroups(MIST, db.getGroupType(KnownGroupTypes.Language) as GroupType)).to.have.lengthOf(1);

      await db.removeGroupRelations(MIST, LANG_ENGLISH);
      expect(await db.relatedGroups(MIST, db.getGroupType(KnownGroupTypes.Language) as GroupType)).to.have.lengthOf(0);
    });

    it("should remove relations of specific group type", async function () {
      await db.addGroupRelation(MIST, TAG1);
      await db.addGroupRelation(MIST, TAG2);
      await db.addGroupRelation(MIST, LANG_ENGLISH);
      await db.addGroupRelation(MIST, LANG_RUSSIAN);
      await db.addGroupRelation(MIST, CATEGORY1);

      expect(await db.relatedGroups(MIST)).to.have.lengthOf(5);

      await db.removeGroupRelations(MIST, undefined, db.getGroupType(KnownGroupTypes.Language) as GroupType);

      expect(await db.relatedGroups(MIST)).to.have.lengthOf(3);
    });
  });

  describe("Time handling", function () {
    let db: LibraryDatabase;
    let clock: sinon.SinonFakeTimers;

    beforeEach(function () {
      clock = sinon.useFakeTimers();

      db = new LibraryDatabase(':memory:');
      return db.create();
    });

    afterEach(function () {
      clock.restore();
    });

    it("addDate and lastModifyDate should be ignored", async function () {
      let date = new Date();

      clock.tick(10000);

      let datePast = new Date();

      await db.addResource({
        uuid: TEST_UUID,
        title: 'some title',
        titleSort: 'some title sort',
        rating: 0,
        addDate: date,
        lastModifyDate: date,
        publishDate: '',
        publisher: '',
        desc: ''
      });

      let res = await db.getResource(TEST_UUID) as Resource;
      expect(res.uuid).to.be.equal(TEST_UUID);
      expect(dateToTimestamp(res.addDate as Date)).to.be.equal(dateToTimestamp(datePast));
      expect(dateToTimestamp(res.lastModifyDate as Date)).to.be.equal(dateToTimestamp(datePast));
    });

    it("should store adding date to addDate", async function () {
      clock.tick(10000);

      await db.addResource({
        uuid: TEST_UUID,
        title: 'some title',
        titleSort: 'some title sort',
        rating: 0,
        addDate: undefined,
        lastModifyDate: undefined,
        publishDate: '',
        publisher: '',
        desc: ''
      });

      let res = await db.getResource(TEST_UUID) as Resource;
      expect(dateToTimestamp(res.addDate as Date)).to.be.equal(10);
      expect(dateToTimestamp(res.lastModifyDate as Date)).to.be.equal(10);
    });

    it("should save modification date", async function () {
      clock.tick(10000);

      await db.addResource({
        uuid: TEST_UUID,
        title: 'some title',
        titleSort: 'some title sort',
        rating: 0,
        addDate: undefined,
        lastModifyDate: undefined,
        publishDate: '',
        publisher: '',
        desc: ''
      });

      clock.tick(10000);

      await db.updateResource({
        uuid: TEST_UUID,
        title: 'some title 2',
        titleSort: 'some title sort',
        rating: 0,
        addDate: undefined,
        lastModifyDate: undefined,
        publishDate: '',
        publisher: '',
        desc: ''
      });

      let res = await db.getResource(TEST_UUID) as Resource;
      expect(dateToTimestamp(res.addDate as Date)).to.be.equal(10);
      expect(dateToTimestamp(res.lastModifyDate as Date)).to.be.equal(20);
    });

    it('should store publishDate as a Date', async function () {
      let date = new Date();

      await db.addResource({
        uuid: TEST_UUID,
        title: 'some title',
        titleSort: 'some title sort',
        rating: 0,
        addDate: date,
        lastModifyDate: date,
        publishDate: date,
        publisher: '',
        desc: ''
      });

      let res = await db.getResource(TEST_UUID) as Resource;
      expect(res.uuid).to.be.equal(TEST_UUID);
      expect(res.publishDate).to.be.instanceOf(Date);
      expect(dateToTimestamp(res.publishDate as Date)).to.be.equal(dateToTimestamp(date));
    });

    it("should store publishDate as a string", async function () {
      let date = new Date();

      await db.addResource({
        uuid: TEST_UUID,
        title: 'some title',
        titleSort: 'some title sort',
        rating: 0,
        addDate: date,
        lastModifyDate: date,
        publishDate: '5th century',
        publisher: '',
        desc: ''
      });

      let res = await db.getResource(TEST_UUID) as Resource;
      expect(res.uuid).to.be.equal(TEST_UUID);
      expect(res.publishDate as string).to.be.equal('5th century');
    });
  });
});

const MIST = uuid.v4(),
      TOLL = uuid.v4(),
      MOCKINGBIRD = uuid.v4(),
      KING = uuid.v4(),
      HEMINGWAY = uuid.v4(),
      LEE = uuid.v4(),
      PERSON1 = uuid.v4(),
      PERSON2 = uuid.v4(),
      PERSON3 = uuid.v4(),
      TAG1 = uuid.v4(),
      TAG2 = uuid.v4(),
      LANG_ENGLISH = uuid.v4(),
      LANG_RUSSIAN = uuid.v4(),
      CATEGORY1 = uuid.v4(),
      CATEGORY2 = uuid.v4();

async function fillTestData(db: LibraryDatabase) {
  await db.addResource({
    uuid: MIST,
    title: "The Mist",
    titleSort: "Mist, The",
    rating: 400,
    addDate: new Date(),
    lastModifyDate: new Date(),
    publishDate: "1980",
    publisher: "Viking Press",
    desc: "The Mist is a horror novella by the American author Stephen King, in which the small town of Bridgton, Maine is suddenly enveloped in an unnatural mist that conceals otherworldly monsters."
  });

  await db.addResource({
    uuid: TOLL,
    title: "For Whom the Bell Tolls",
    titleSort: "For Whom the Bell Tolls",
    rating: 400,
    addDate: new Date(),
    lastModifyDate: new Date(),
    publishDate: "1940",
    publisher: "Charles Scribner's Sons",
    desc: "For Whom the Bell Tolls is a novel by Ernest Hemingway published in 1940. It tells the story of Robert Jordan, a young American in the International Brigades attached to a republican guerrilla unit during the Spanish Civil War."
  });

  await db.addResource({
    uuid: MOCKINGBIRD,
    title: "To Kill a Mockingbird",
    titleSort: "Kill a Mockingbird, To",
    rating: 400,
    addDate: new Date(),
    lastModifyDate: new Date(),
    publishDate: "1960",
    publisher: "",
    desc: "To Kill a Mockingbird is a novel by Harper Lee published in 1960. It was immediately successful, winning the Pulitzer Prize, and has become a classic of modern American literature."
  });

  await db.addPerson({
    uuid: KING,
    name: 'Stephen King',
    nameSort: 'King, Stephen'
  });

  await db.addPerson({
    uuid: HEMINGWAY,
    name: 'Ernest Hemingway',
    nameSort: 'Hemingway, Ernest'
  });

  await db.addPerson({
    uuid: LEE,
    name: "Harper Lee",
    nameSort: "Lee, Harper"
  });

  await db.addPerson({
    uuid: PERSON1,
    name: 'Person 1',
    nameSort: 'Person 1'
  });

  await db.addPerson({
    uuid: PERSON2,
    name: 'Person 2',
    nameSort: 'Person 2'
  });

  await db.addPerson({
    uuid: PERSON3,
    name: 'Person 3',
    nameSort: 'Person 3'
  });

  await db.addGroup({
    uuid: TAG1,
    groupType: db.getGroupType(KnownGroupTypes.Tag) as GroupType,
    title: 'tag 1',
    titleSort: 'tag 1'
  });

  await db.addGroup({
    uuid: TAG2,
    groupType: db.getGroupType(KnownGroupTypes.Tag) as GroupType,
    title: 'tag 2',
    titleSort: 'tag 2'
  });

  await db.addGroup({
    uuid: LANG_ENGLISH,
    groupType: db.getGroupType(KnownGroupTypes.Language) as GroupType,
    title: 'english',
    titleSort: 'english'
  });

  await db.addGroup({
    uuid: LANG_RUSSIAN,
    groupType: db.getGroupType(KnownGroupTypes.Language) as GroupType,
    title: 'russian',
    titleSort: 'russian'
  });

  await db.addGroup({
    uuid: CATEGORY1,
    groupType: db.getGroupType(KnownGroupTypes.Category) as GroupType,
    title: 'group 1',
    titleSort: 'group 1'
  });

  await db.addGroup({
    uuid: CATEGORY2,
    groupType: db.getGroupType(KnownGroupTypes.Category) as GroupType,
    title: 'group 2',
    titleSort: 'group 2'
  });
}
