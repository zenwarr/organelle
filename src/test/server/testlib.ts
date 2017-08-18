import uuid = require("uuid");
import {Library} from "../../server/library";
import {GroupType, KnownGroupTypes, LibraryDatabase, PersonRelation} from "../../server/library-db";

export const MIST = uuid.v4(),
    TOLL = uuid.v4(),
    MOCKINGBIRD = uuid.v4(),
    CRIME = uuid.v4(),
    QUIXOTE = uuid.v4(),
    TIME = uuid.v4(),
    ULYSSES = uuid.v4(),
    ODYSSEY = uuid.v4(),
    WAR = uuid.v4(),
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

export const RES_COUNT: number = 3,
    AUTHORS_COUNT = 1,
    TAG_COUNT = 2,
    LANG_COUNT = 2;

export async function createTestLib(): Promise<LibraryDatabase> {
  let db = new LibraryDatabase(':memory:');
  await db.create();

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

  await db.addResource({
    uuid: CRIME,
    title: 'Crime and Punishment',
    titleSort: 'Crime and Punishment'
  });

  await db.addResource({
    uuid: QUIXOTE,
    title: 'Don Quixote',
    titleSort: 'Don Quixote'
  });

  await db.addResource({
    uuid: TIME,
    title: 'In Search of Lost Time',
    titleSort: 'In Search of Lost Time'
  });

  await db.addResource({
    uuid: ULYSSES,
    title: 'Ulysses',
    titleSort: 'Ulysses'
  });

  await db.addResource({
    uuid: ODYSSEY,
    title: 'The Odyssey',
    titleSort: 'Odyssey, The'
  });

  await db.addResource({
    uuid: WAR,
    title: 'The Art of War',
    titleSort: 'Art of War, The'
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

  return db;
}
