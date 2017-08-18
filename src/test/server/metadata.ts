import {should, expect} from 'chai';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {GroupType, KnownGroupTypes, LibraryDatabase, Resource, PersonRelation} from "../../server/library-db";
import uuid = require("uuid");
import {TemplateProcessor} from "../../server/formatter";
import {createResourceVarResolver} from "../../server/metadata";

should();
chai.use(chaiAsPromised);

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
    CATEGORY2 = uuid.v4(),
    SERIES1 = uuid.v4();

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

  await db.addGroup({
    uuid: SERIES1,
    groupType: db.getGroupType(KnownGroupTypes.Series) as GroupType,
    title: 'The Cool Series',
    titleSort: 'Cool Series, The'
  });

  await db.addPersonRelation(MIST, KING, PersonRelation.Author);

  await db.addGroupRelation(MIST, SERIES1, 1);
}

describe('metadata', function() {
  describe('resource resolver', function() {
    let lib: LibraryDatabase;
    let proc: TemplateProcessor;

    beforeEach(async function() {
      lib = new LibraryDatabase(':memory:');
      await lib.create();

      await fillTestData(lib);

      proc = new TemplateProcessor(await createResourceVarResolver(lib,
          await lib.getResource(MIST) as Resource));
    });

    it("should resolve title", async function () {
      return proc.process('{title}').should.eventually.be.equal('The Mist');
    });

    it("should resolve title sort", async function () {
      return proc.process('{title#sort}').should.eventually.be.equal('Mist, The');
    });

    it("should resolve author", async function () {
      return proc.process('{author}').should.eventually.be.equal('Stephen King');
    });

    it("should resolve author sort", async function () {
      return proc.process('{author#sort}').should.eventually.be.equal('King, Stephen');
    });

    it("should resolve author list", async function () {
      await lib.addPersonRelation(MIST, PERSON2, PersonRelation.Author);
      expect(await proc.process('{authors}')).to.be.oneOf(
          ['Stephen King, Person 2', 'Person 2, Stephen King']);
    });

    it("should resolve series index", async function () {
      expect(await proc.process('{series#sort} {?series#index|wrap("[@]")}'))
          .to.be.equal('Cool Series, The [1]');
    });

    it("should resolve author sort list", async function () {
      await lib.addPersonRelation(MIST, PERSON2, PersonRelation.Author);
      expect(await proc.process('{authors#sort|join(" & ")}')).to.be.oneOf(
          ['King, Stephen & Person 2', 'Person 2 & King, Stephen']);
    });

    it("should resolve rating", async function () {
      await lib.updateResource({
        uuid: MIST,
        rating: 400
      });
      expect(await proc.process('{rating|format_num("0.00")}')).to.be.equal('4.00');
      expect(await proc.process('{rating}')).to.be.equal('4');
    });
  });
});

