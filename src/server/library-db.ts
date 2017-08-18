import {Database, DatabaseWithOptions} from './db';
import * as uuid from 'uuid';
import {dateToTimestamp, timestampToDate} from "./common";

export const CUR_LIBRARY_VERSION = 1;

/**
 * Resources are basic building blocks of a library. Any book or article or a magazine issue you store is a Resource.
 */
export interface Resource {
  uuid?: string|null;

  /**
   * Title of a resource that is displayed to user.
   */
  title?: string;

  /**
   * Much like a title, but is used to sort resources in alphabetic order.
   */
  titleSort?: string;

  /**
   * Rating of a resource. A library user is not the only man who can rate books. And honestly, Organelle has no need
   * to store a ratings made by a user. This field stores ratings fetched from online services like Amazon that
   * characterizes an average rating from many people.
   * Rating system is 5-stars, so max rating a resource can have is 5. It can fractional, for example, 4.3 is
   * completely normal. To keep away from rounding issues, rating is stored in form of an integer
   * as (real_rating * 100). So 4.3 will be stored in this property as an 430. Keep it in mind while showing
   * rating to a user.
   * Value of this field should be in [0...500] range (inclusive).
   */
  rating?: number;

  /**
   * Indicates when the resource have been added to a library.
   */
  addDate?: Date;

  /**
   * Indicates when the resource have been updated last time.
   */
  lastModifyDate?: Date;

  /**
   * Publication date for a resource. It is not a timestamp, but just a text, because in most cases you cannot
   * measure precise time a book came off the presses. It is even harder when book is too old. Everything you
   * know about the "The Art of War" is that it was written around 5th century BC (of course, you own a more recent
   * version of the book that has a well-known publication (or compilation) date, but in most cases this
   * information is useless and some people want to provide more precise information on book contents itself).
   * You still can store a Date object here, and it will be correctly handled.
   */
  publishDate?: string|Date;

  /**
   * Publisher, if it makes any sense to the resource.
   */
  publisher?: string;

  /**
   * Description of the resource.
   */
  desc?: string;
}

export interface NewResource extends Resource {
  title: string;
  titleSort: string;
}

export interface UpdateResource extends Resource {
  uuid: string;
}

/**
 * Any person that should be mentioned in library (author, translator or editor) is represented by such objects.
 */
export interface Person {
  uuid?: string|null;

  /**
   * Name of a person.
   */
  name?: string;

  /**
   * Used instead of a name when sorting persons in alphabetical order.
   */
  nameSort?: string;
}

export interface NewPerson extends Person {
  name: string;
  nameSort: string;
}

export interface UpdatePerson extends Person {
  uuid: string;
}

export enum PersonRelation {
  Author = 1,
  Editor,
  Translator
}

/**
 * An extended version of Person, which mentions a relation this person has to a resource. All supported types
 * of relations are listed in {@link PersonRelation} enumeration.
 */
export interface RelatedPerson extends Person {
  relation: PersonRelation;
}

/**
 * Books are grouped into... groups. A tag is a group. A category is a group. A series a book belongs to is a group.
 * Groups can have different types that separate different sets of groups one of another.
 * For example, if you want to tag all cool books with a tag named "cool books" you should first create a group
 * with name = "cool books" and group type of KnownGroupTypes.Tags and create a relation between each cool book
 * and this group. You can create you own groups.
 */
export interface Group {
  uuid?: string|null;

  /**
   * Group title
   */
  title?: string;

  /**
   * Used instead of title when sorting groups in alphabetic order.
   */
  titleSort?: string;

  /**
   * Type of this group.
   */
  groupType?: GroupType;
}

export interface NewGroup {
  uuid?: string|null;
  title: string;
  titleSort: string;
  groupType: GroupType|string;
}

export interface UpdateGroup extends Group {
  uuid: string;
}

/**
 * An extended version of a Group that mentions index a resource has in a group it relates to.
 */
export interface RelatedGroup extends Group {
  /**
   * Group index should be always positive or null. Any negative value will be ignored.
   */
  groupIndex: number|null;

  /**
   * Relation tag contains extra information on a relation between a resource and a group.
   * The exact meaning of the relation tag depends on group type.
   */
  relationTag: any;
}

/**
 * Each group has a type. Any library supports a set of predefined group types (see a list below) with predefined UUIDs.
 * You can create you own group types, create groups of this type and link resources to these groups.
 */
export interface GroupType {
  uuid?: string|null;

  /**
   * Type name
   */
  name?: string;

  /**
   * If group is exclusive, a resource can be linked to only one group of this type. An example of an exclusive group type
   * is category type: a book cannot belong to two categories at same time. Tags are not exclusive and you can add
   * as much tags as you with to a single book.
   */
  exclusive?: boolean;

  /**
   * If group is ordered, resources in the groups are ordered and you can specify an index of a resource has in
   * a group. An example of an ordered group is series type: each book in series has its number. But indexes are
   * optional, any resource can relate to an ordered group while omitting an index.
   */
  ordered?: boolean;
}

export interface NewGroupType extends GroupType {
  name: string;
  exclusive: boolean;
  ordered: boolean;
}

export interface UpdateGroupType extends GroupType {
  uuid: string;
}

export enum ObjectRole {
  Format = 1
}

export interface RelatedObject {
  rowId?: number;
  resourceUuid?: string;
  uuid?: string|null;
  role?: ObjectRole;
  tag?: string;
}

/**
 * Predefined group types that should be supported by every library database.
 */
export enum KnownGroupTypes {
  Tag = '0385ee32-fb86-475c-8d93-b1f0590cb089',
  Series = '509d7919-5462-4687-89b4-97afebcac3eb',
  Category = '77c0939e-4dcc-4d30-a528-8385a3ce96e3',
  Language = '2dbbbec1-80c0-4be6-a55f-90d3586b3282'
}

const KNOWN_GROUP_TYPES_DATA: GroupType[] = [
  {
    uuid: KnownGroupTypes.Tag,
    name: 'tags',
    exclusive: false,
    ordered: false
  },
  {
    uuid: KnownGroupTypes.Series,
    name: 'series',
    exclusive: false,
    ordered: true
  },
  {
    uuid: KnownGroupTypes.Category,
    name: 'category',
    exclusive: true,
    ordered: false
  },
  {
    uuid: KnownGroupTypes.Language,
    name: 'language',
    exclusive: false,
    ordered: false
  }
];

export class LibraryDatabase extends DatabaseWithOptions {
  constructor(filename: string) {
    super(filename, CUR_LIBRARY_VERSION);
  }

  async create(): Promise<void> {
    await super.create();

    const SCHEMA: string[] = [
        `CREATE TABLE resources(uuid TEXT PRIMARY KEY, title TEXT NOT NULL, title_sort TEXT NOT NULL, rating SMALLINT, 
              add_date DATETIME, last_modify_date DATETIME, publish_date TEXT, publisher TEXT, desc TEXT)`,
        `CREATE TABLE persons(uuid TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, name_sort TEXT NOT NULL)`,
        `CREATE TABLE res_to_persons(res_id TEXT NOT NULL, person_id TEXT NOT NULL, relation INTEGER NOT NULL,
              UNIQUE(res_id, person_id, relation),
              FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT,
              FOREIGN KEY(person_id) REFERENCES persons(uuid) ON DELETE CASCADE ON UPDATE RESTRICT)`,
        `CREATE TABLE group_types(uuid TEXT PRIMARY KEY, name TEXT UNIQUE, exclusive BOOLEAN, ordered BOOLEAN)`,
        `CREATE TABLE groups(uuid TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, title_sort TEXT NOT NULL,
              FOREIGN KEY(type) REFERENCES group_types(uuid) ON DELETE CASCADE ON UPDATE RESTRICT)`,
        `CREATE TABLE res_to_groups(res_id TEXT NOT NULL, group_id TEXT NOT NULL, group_index INTEGER NOT NULL,
              relation_tag TEXT NOT NULL DEFAULT '',
              UNIQUE(res_id, group_id, group_index, relation_tag),
              FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT,
              FOREIGN KEY(group_id) REFERENCES groups(uuid) ON DELETE CASCADE ON UPDATE RESTRICT)`,
        `CREATE TABLE objects(id INTEGER PRIMARY KEY, res_id TEXT NOT NULL, uuid TEXT NOT NULL,
              role INTEGER NOT NULL, tag TEXT,
              UNIQUE(res_id, uuid, role, tag),
              FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT)`,
    ];

    for (let query of SCHEMA) {
      await this.db.run(query);
    }

    // add known groups
    let stmt = await this.db.prepare("INSERT INTO group_types(uuid, name, exclusive, ordered) VALUES(?, ?, ?, ?)");
    try {
      for (let gd of KNOWN_GROUP_TYPES_DATA) {
        stmt.run(gd.uuid, gd.name, gd.exclusive, gd.ordered);
      }
    } finally {
      stmt.finalize();
    }

    // and copy these known groups to group types
    this._groupTypes = KNOWN_GROUP_TYPES_DATA.map(x => x);
  }

  async open(): Promise<void> {
    await super.open();
    await this._loadGroupTypes();
  }

  /**
   * Get group type with specified UUID (sync function).
   * @param {string} uuid UUID of group type
   * @returns {GroupType|null} GroupType object for the type or null if type has not been found.
   */
  getGroupType(uuid: string): GroupType|null {
    uuid = Database._validateId(uuid);
    let found = this._groupTypes.find(x => x.uuid === uuid);
    return found == null ? null : { ...found };
  }

  /**
   * Adds new group type into the library. If UUID is specified on gtData argument, registered type will have
   * the specified UUID, otherwise new one will be generated.
   * @param {GroupType} gtData GroupType object containing properties of the new group type.
   * @returns {Promise<GroupType>} GroupType object that has been added.
   */
  async addGroupType(gtData: NewGroupType): Promise<GroupType> {
    let createdType = await this._addEntry(gtData, GroupTypeSpec);
    this._groupTypes.push({ ...createdType });
    return createdType;
  }

  /**
   * Removes group type from the library. If no type with given UUID exists, the function will fail.
   * @param {string} groupType UUID of the GroupType object to remove
   * @returns {Promise<void>}
   */
  async removeGroupType(groupType: GroupType|string) : Promise<void> {
    groupType = Database.getId(groupType);

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === groupType);
    if (typeIndex < 0) {
      throw new Error('Cannot remove group type: type does not exist');
    }

    await this._removeEntry(groupType, GroupTypeSpec);

    this._groupTypes.splice(typeIndex, 1);
  }

  /**
   * Change an existing group type.
   * @param {GroupType} gt GroupType object with new properties for this type. This object must have UUID specified,
   * otherwise the function will fail.
   */
  async updateGroupType(gt: UpdateGroupType): Promise<void> {
    let uuid = Database._validateId(gt.uuid);

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === uuid);
    if (typeIndex < 0) {
      throw new Error('Cannot update group type: type does not exist');
    }

    await this._updateEntry(gt, GroupTypeSpec);

    this._groupTypes[typeIndex] = { ...gt, uuid: uuid };
  }

  /**
   * Get a resource with given UUID.
   * @param {string} uuid UUID of the resource to find.
   * @returns {Promise<Resource|null>} Resource object for the type or null of resource has not been found.
   */
  getResource(uuid: string): Promise<Resource|null> {
    return this._getEntry<Resource>(uuid, ResourceSpec);
  }

  /**
   * Add a new resource. If UUID is specified on res argument, registered resource will have the specified UUID,
   * otherwise new one will be generated.
   * @param {Resource} res Resource object containing properties of the new resource.
   * @returns {Promise<Resource>} Resource object that has been added.
   */
  addResource(res: NewResource): Promise<Resource> {
    let curDate = new Date();
    return this._addEntry({ ...res, addDate: curDate, lastModifyDate: curDate }, ResourceSpec);
  }

  /**
   * Change an existing resource.
   * @param {Resource} res Resource object with new properties for this resource. This object must have UUID specified,
   * otherwise the function will fail.
   */
  updateResource(res: UpdateResource): Promise<void> {
    let updData = { ...res };
    updData.lastModifyDate = new Date();
    delete updData.addDate;

    return this._updateEntry(updData, ResourceSpec);
  }

  /**
   * Remove resource from the library. If no resource with given UUID exists, the function will fail.
   * @param {string} resource UUID of the resource to remove
   * @returns {Promise<void>}
   */
  removeResource(resource: Resource|string): Promise<void> {
    return this._removeEntry(Database.getId(resource), ResourceSpec);
  }

  /**
   * Get a person with given UUID.
   * @param {string} uuid UUID of the person to find.
   * @returns {Promise<Person|null>} Person object for the type or null of person has not been found.
   */
  getPerson(uuid: string): Promise<Person|null> {
    return this._getEntry(uuid, PersonSpec);
  }

  /**
   * Add a new person. If UUID is specified on pers argument, registered person will have the specified UUID,
   * otherwise new one will be generated.
   * @param {Resource} pers Person object containing properties of the new person.
   * @returns {Promise<Resource>} Person object that has been added.
   */
  addPerson(pers: NewPerson): Promise<Person> {
    return this._addEntry(pers, PersonSpec);
  }

  /**
   * Change an existing person.
   * @param {Resource} pers Person object with new properties for this person. This object must have UUID specified,
   * otherwise the function will fail.
   */
  updatePerson(pers: UpdatePerson): Promise<void> {
    return this._updateEntry(pers, PersonSpec);
  }

  /**
   * Remove person from the library. If no perosn with given UUID exists, the function will fail.
   * @param {string} person UUID of the person to remove
   * @returns {Promise<void>}
   */
  removePerson(person: Person|string): Promise<void> {
    return this._removeEntry(Database.getId(person), PersonSpec);
  }

  async findPersons(name: string): Promise<Person[]> {
    let where = new WhereClauseBuilder();
    where.add('name', name);

    let rows = await this.db.all(`SELECT * FROM persons WHERE ${where.clause}`, where.bound);
    return rows.map((row: any) => PersonSpec.rowToEntry(row));
  }

  async findPerson(name: string): Promise<Person|null> {
    let persons = await this.findPersons(name);
    return persons.length > 0 ? persons[0] : null;
  }

  /**
   * Get a group with given UUID.
   * @param {string} uuid UUID of the group to find.
   * @returns {Promise<Group|null>} Group object for the type or null of group has not been found.
   */
  getGroup(uuid: string): Promise<Group|null> {
    return this._getEntry(uuid, this._groupSpec);
  }

  /**
   * Add a new group. If UUID is specified on group argument, registered group will have the specified UUID,
   * otherwise new one will be generated.
   * @param {Resource} group Group object containing properties of the new group.
   * @returns {Promise<Group>} Group object that has been added.
   */
  async addGroup(group: NewGroup): Promise<Group> {
    return await this._addEntry<NewGroup>(group, this._groupSpec) as Group;
  }

  async addTag(text: string, textSort?: string): Promise<Group> {
    return this.addGroup({
      title: text,
      titleSort: textSort ? textSort : text,
      groupType: KnownGroupTypes.Tag
    });
  }

  async addCategory(text: string, textSort?: string): Promise<Group> {
    return this.addGroup({
      title: text,
      titleSort: textSort ? textSort : text,
      groupType: KnownGroupTypes.Category
    });
  }

  async addLang(code: string): Promise<Group> {
    return this.addGroup({
      title: code.toLowerCase(),
      titleSort: code.toLowerCase(),
      groupType: KnownGroupTypes.Language
    });
  }

  async addSeries(title: string, titleSort?: string): Promise<Group> {
    return this.addGroup({
      title: title,
      titleSort: titleSort ? titleSort : title,
      groupType: KnownGroupTypes.Series
    });
  }

  async tag(text: string): Promise<Group> {
    return await this.findGroup(text, KnownGroupTypes.Tag) || await this.addTag(text);
  }

  async lang(code: string): Promise<Group> {
    return await this.findGroup(code.toLowerCase(), KnownGroupTypes.Language) || await this.addLang(code);
  }

  async category(text: string): Promise<Group> {
    return await this.findGroup(text, KnownGroupTypes.Category) || await this.addCategory(text);
  }

  async series(text: string): Promise<Group> {
    return await this.findGroup(text, KnownGroupTypes.Series) || await this.addSeries(text);
  }

  async findGroup(text: string, groupType: GroupType|string): Promise<Group|null> {
    let where = new WhereClauseBuilder();
    where.add('title', text);

    let result = await this.findGroupsWhere(where);
    return result.length > 0 ? result[0] : null;
  }

  async findGroupsWhere(where: WhereClauseBuilder): Promise<Group[]> {
    let rows = await this.db.all(`SELECT * FROM groups WHERE ${where.clause}`, where.bound);
    return rows.map((row: any): Group => this._groupSpec.rowToEntry(row));
  }

  /**
   * Change an existing group.
   * @param {Resource} group Group object with new properties for this group. This object must have UUID specified,
   * otherwise the function will fail.
   */
  updateGroup(group: UpdateGroup): Promise<void> {
    return this._updateEntry(group, this._groupSpec);
  }

  /**
   * Remove group from the library. If no group with given UUID exists, the function will fail.
   * @param {string} group UUID of the group to remove
   * @returns {Promise<void>}
   */
  removeGroup(group: Group|string): Promise<void> {
    return this._removeEntry(Database.getId(group), this._groupSpec);
  }

  /**
   * Create a relation between a resource and person.
   * @param {string} resource UUID of a resource
   * @param {string} person UUID of a person
   * @param {PersonRelation} relation Type of relation to create
   * @returns {Promise<void>}
   */
  async addPersonRelation(resource: Resource|string, person: Person|string, relation: PersonRelation): Promise<void> {
    resource = Database._validateId(Database.getId(resource));
    person = Database._validateId(Database.getId(person));

    await this.db.run("INSERT INTO res_to_persons(res_id, person_id, relation) VALUES(?, ?, ?)",
        [ resource, person, PersonRelationSpec.prop('relation').toDb(relation) ]);
  }

  /**
   * Removes an existing relation (or relations) between a resource and a person. If no relations exist, the function
   * will do nothing. Call it with the only first argument to remove all person relations for a resource.
   * @param {string} resource UUID of a resource
   * @param {string} person UUID of a person. If not specified, all person relations for the given resource that
   * have relation type as specified in {@link relation} are going to be removed.
   * @param {PersonRelation} relation Type of relation to remove. If not specified, relations are going to be
   * removed regardless of the relation type.
   * @returns {Promise<void>}
   */
  async removePersonRelations(resource: Resource|string, person?: Person|string, relation?: PersonRelation): Promise<void> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));

    if (person != null) {
      whereClause.add('person_id', Database.getId(person));
    }

    if (relation != null) {
      whereClause.add('relation', PersonRelationSpec.prop('relation').toDb(relation));
    }

    await this.db.run(`DELETE FROM res_to_persons WHERE ${whereClause.clause}`, whereClause.bound);
  }

  /**
   * Get a list of persons this resource relates to.
   * @param {string} resource UUID of a resource
   * @param {PersonRelation} relation Type of relations you are interested in. If not specified, all relations
   * will be returned.
   * @returns {Promise<RelatedPerson[]>} List of relations between persons and this resource.
   */
  async relatedPersons(resource: Resource|string, relation?: PersonRelation): Promise<RelatedPerson[]> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));
    if (relation != null) {
      whereClause.add('relation', PersonRelationSpec.prop('relation').toDb(relation));
    }

    let rows: any[] = await this.db.all(
        `SELECT relation, uuid, name, name_sort FROM res_to_persons LEFT JOIN persons ON res_to_persons.person_id = persons.uuid WHERE ${whereClause.clause}`,
        whereClause.bound);

    let results: RelatedPerson[] = [];
    for (let row of rows) {
      let person = PersonSpec.rowToEntry<RelatedPerson>(row);
      PersonRelationSpec.rowToEntry(row, person);
      results.push(person);
    }

    return results;
  }

  /**
   * Creates a new relation between a resource and a group.
   * @param {string} resource UUID of a resource
   * @param {string} groupUuid UUID of a group to relate to
   * @param {number} groupIndex If group is ordered, you can provide an index this resource has in the group.
   * If not specified, relation will have no index. If you specify an index and group you are going to link to
   * is not ordered, the function will fail.
   * @param relationTag relation tag containing context-dependent information on the relation
   * @returns {Promise<RelatedGroup>} Relation that has been created
   */
  async addGroupRelation(resource: Resource|string, groupUuid: Group|string,
                         groupIndex?: number, relationTag?: any): Promise<RelatedGroup> {
    resource = Database.getId(resource);
    groupUuid = Database.getId(groupUuid);

    let group = await this.getGroup(groupUuid);
    if (group == null) {
      throw new Error(`Cannot add relation to group with UUID = ${groupUuid}: no such group exists`);
    }

    if (group.groupType == null) {
      throw new Error('Invalid group type');
    }

    if (groupIndex != null && !group.groupType.ordered) {
      throw new Error(`Cannot add relation with group index to group (UUID = ${groupUuid}) that is not ordered`);
    }

    if (group.groupType.exclusive) {
      // check if resource already has any relations with groups of same type
      let relatedGroupsOfSameType = await this.relatedGroups(resource, group.groupType);
      if (relatedGroupsOfSameType.length > 0) {
        throw new Error(`Cannot add relation with group (UUID = ${groupUuid}) because group type is exclusive and` +
            `the resource already has a relation to a group with same type`);
      }
    }

    await this.db.run("INSERT INTO res_to_groups(res_id, group_id, group_index, relation_tag) VALUES(?, ?, ?, ?)",
        [ resource, groupUuid,
          GroupRelationSpec.prop('groupIndex').toDb(groupIndex),
          GroupRelationSpec.prop('relationTag').toDb(relationTag)]);

    let relGroup: RelatedGroup = group as RelatedGroup;
    relGroup.groupIndex = groupIndex == null ? null : groupIndex;
    relGroup.relationTag = relationTag == null ? null : relationTag;
    return relGroup;
  }

  async addTagToResource(resource: Resource|string, tagText: string): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.tag(tagText));
  }

  async addLangToResource(resource: Resource|string, langCode: string, original?: boolean): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.lang(langCode), undefined, original);
  }

  async addSeriesToResource(resource: Resource|string, seriesName: string,
                            seriesIndex: number, comment?: string): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.series(seriesName), seriesIndex, comment);
  }

  /**
   * Removes existing relation (or relations) between a resource and a group. If no relations exist, the function
   * will do nothing. Call it with the only first argument to remove all group relations for a resource.
   * @param {string} resource UUID of a resource
   * @param {string} group UUID of a group. If specified, only relations between the resource and this group are going
   * to be removed (taking {@link groupType} into account, of course).
   * @param {GroupType} groupType If specified, only relations between the resource and groups with given type are
   * going to be removed.
   * @param relationTag If specified, relations between the resource and groups with given relation tag are going to be removed.
   * @returns {Promise<void>}
   */
  async removeGroupRelations(resource: Resource|string, group?: Group|string,
                             groupType?: GroupType|string, relationTag?: any): Promise<void> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));
    if (group != null) {
      whereClause.add('group_id', Database.getId(group));
    }

    if (relationTag != null) {
      whereClause.add('relation_tag', relationTag);
    }

    if (typeof groupType === 'string') {
      groupType = this.getGroupType(groupType) as (GroupType|undefined);
    }

    if (groupType != null) {
      whereClause.addRaw('group_id IN (SELECT uuid FROM groups WHERE type = ?)', groupType.uuid);
    }

    await this.db.run(`DELETE FROM res_to_groups WHERE ${whereClause.clause}`, whereClause.bound);
  }

  /**
   * Get a list of groups a resource relates to.
   * @param {string} resource UUID of a resource
   * @param {GroupType} groupType If specified, only relations with groups of the specified type will be returned.
   * If not specified, all relations regardless of type will be returned.
   * @returns {Promise<RelatedGroup[]>}
   */
  async relatedGroups(resource: Resource|string, groupType?: GroupType|string): Promise<RelatedGroup[]> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));

    if (typeof groupType === 'string') {
      let fetchedGroupType = this.getGroupType(groupType) as (GroupType|undefined);
      if (!groupType) {
        throw new Error(`No group type with UUID [${groupType}] exist`);
      }
      groupType = fetchedGroupType;
    }

    if (groupType != null) {
      whereClause.addRaw('group_id IN (SELECT uuid FROM groups WHERE type = ?)', groupType.uuid);
    }

    let rows: any[] =
        await this.db.all(`SELECT group_index, relation_tag, uuid, type, title, title_sort FROM res_to_groups ` +
        `LEFT JOIN groups ON res_to_groups.group_id = groups.uuid WHERE ${whereClause.clause}`,
        whereClause.bound);

    let results: RelatedGroup[] = [];
    for (let row of rows) {
      let group = this._groupSpec.rowToEntry<RelatedGroup>(row);
      GroupRelationSpec.rowToEntry(row, group);
      results.push(group);
    }

    return results;
  }

  async relatedObjects(resource: Resource|string, role?: ObjectRole, tag?: string): Promise<RelatedObject[]> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));
    if (role != null) {
      whereClause.add('role', ObjectSpec.prop('role').toDb(role));
    }
    if (tag != null) {
      whereClause.add('tag', ObjectSpec.prop('tag').toDb(tag));
    }

    let rows = await this.db.all(`SELECT id, uuid, res_id, role, tag FROM objects WHERE ${whereClause.clause}`,
        whereClause.bound);

    return rows.map(row => ObjectSpec.rowToEntry<RelatedObject>(row));
  }

  async addObjectRelation(resource: Resource|string, obj: RelatedObject): Promise<RelatedObject> {
    resource = Database.getId(resource);
    let objectUuid = Database._validateId(obj.uuid);

    let result = await this.db.run(`INSERT INTO objects(uuid, res_id, role, tag) VALUES(?, ?, ?, ?)`,
        [ objectUuid, resource, ObjectSpec.prop('role').toDb(obj.role),
          ObjectSpec.prop('tag').toDb(obj.tag) ]);

    return { ...obj, rowId: result.lastID, resourceUuid: resource };
  }

  async updateObjectRelation(obj: RelatedObject): Promise<void> {
    if (obj.rowId == null) {
      throw new Error('Cannot update an object relation: rowId is invalid');
    }

    let setClause = new SetClauseBuilder();
    for (let propName of Object.keys(obj)) {
      if (ObjectSpec.columnSupported(propName)) {
        let fieldSpec = ObjectSpec.prop(propName);
        setClause.add(fieldSpec.column, fieldSpec.toDb((obj as any)[fieldSpec.prop]));
      }
    }

    let result = await this.db.run(`UPDATE objects SET ${setClause.clause} WHERE id = ?`,
        [ ...setClause.bound, obj.rowId ]);
    if (result.changes === 0) {
      throw new Error('Cannot update object relation: no record with given rowId exists');
    }
  }

  async removeObjectRelation(obj: RelatedObject): Promise<void> {
    if (obj.rowId == null) {
      throw new Error('Cannot remove object relation: rowId is invalid');
    }

    let result = await this.db.run(`DELETE FROM objects WHERE id = ?`, [ obj.rowId ]);
    if (result.changes === 0) {
      throw new Error('Cannot remove object relation: no record with given rowId exists');
    }
  }

  /** Protected area **/

  protected _groupTypes: GroupType[] = [];

  protected _groupSpec = new EntrySpec('groups', 'group', [
      new UuidFieldSpec(),
      new GenericFieldSpec('title', 'title', PropValidators.String, PropValidators.String),
      new GenericFieldSpec('titleSort', 'title_sort', PropValidators.String, PropValidators.String),
      new GroupTypeFieldSpec('groupType', 'type', this)
  ]);

  protected async _loadGroupTypes(): Promise<void> {
    let types = await this.db.all<{ uuid: string, name: string, exclusive: number, ordered: number}>
                  ("SELECT uuid, name, exclusive, ordered FROM group_types");
    this._groupTypes = types.map(item => {
      return {
        uuid: item.uuid.toLowerCase().trim(),
        name: item.name,
        exclusive: !!item.exclusive,
        ordered: !!item.ordered
      }
    });
  }

  protected async _getEntry<T>(uuid: string, spec: EntrySpec): Promise<T|null> {
    uuid = Database._validateId(uuid);

    let row: { [prop: string]: any }|null = await this.db.get(`SELECT * FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
    if (row == null) {
      return null;
    }

    let entry = spec.rowToEntry<T>(row);
    (entry as any).uuid = uuid;
    return entry;
  }

  protected async _updateEntry<T extends { uuid?: string|null } & { [name: string]: any }>
                  (entry: T, spec: EntrySpec): Promise<void> {
    let entryUuid = Database._validateId(entry.uuid);

    let setList: string[] = [], bound: any[] = [];

    for (let propName of Object.keys(entry)) {
      if (spec.propSupported(propName)) {
        let fieldSpec = spec.prop(propName);

        setList.push(fieldSpec.column + ' = ?');
        bound.push(fieldSpec.toDb(entry[propName]));
      }
    }

    let setClause = setList.join(', ');

    // bind value for WHERE clause
    bound.push(entryUuid);

    let stmt = await this.db.run(`UPDATE ${spec.table} SET ${setClause} WHERE uuid = ?`, bound);

    if (stmt.changes === 0) {
      throw new Error(`Cannot update ${spec.human}: no entry with given UUID have been found`);
    }
  }

  protected async _addEntry<T extends { uuid?: string|null } & { [name: string]: any }>(entry: T, spec: EntrySpec): Promise<T> {
    let entryUuid: string;
    if (entry.uuid == null || entry.uuid.length === 0) {
      entryUuid = uuid.v4().toLowerCase();
    } else {
      entryUuid = entry.uuid.toLowerCase().trim();
    }

    let mappings = spec.fieldSpecs;

    let intoClause = mappings.map(item => item.column).join(', ');
    let valuesClause = (new Array(mappings.length)).fill('?').join(', ');
    let bound = mappings.map(spec => {
      return spec.prop === 'uuid' ? entryUuid : spec.toDb(entry[spec.prop])
    });

    await this.db.run(`INSERT INTO ${spec.table}(${intoClause}) VALUES(${valuesClause})`, bound);

    return workaroundSpread(entry, entryUuid);
  }

  protected async _removeEntry<T>(uuid: string, spec: EntrySpec): Promise<void> {
    uuid = Database._validateId(uuid);
    await this.db.run(`DELETE FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
  }
}

type PropValidator = (value: any) => boolean;
type PropConvertor = (value: any) => any;

namespace PropValidators {
  function ofClass(value: any, className: string): boolean {
    return Object.prototype.toString.call(value) === '[object ' + className + ']';
  }

  export const String = (value: any): boolean => typeof value == 'string' || ofClass(value, 'String');
  export const Number = (value: any): boolean => typeof value == 'number' || ofClass(value, 'Number');
  export const Boolean = (value: any): boolean => typeof value == 'boolean' || ofClass(value, 'Boolean');
  export const Date = (value: any): boolean => ofClass(value, 'Date');
  export const Empty = (value: any): boolean => value === null || value === undefined;

  export function OneOf(...validators: PropValidator[]): PropValidator {
    return function(value: any): boolean {
      return validators.some(validator => validator(value));
    }
  }

  export function Both(...validators: PropValidator[]): PropValidator {
    return function(value: any): boolean {
      return validators.every(validator => validator(value));
    }
  }

  export function OfClass(className: string): PropValidator {
    return function(value: any): boolean {
      return ofClass(value, className);
    }
  }
}

class EntrySpec {
  constructor(protected _table: string, protected _human: string, protected _fieldSpecs: FieldSpec[],
              protected _id: string = 'uuid') { }

  get fieldSpecs(): FieldSpec[] { return this._fieldSpecs; }
  get table(): string { return this._table; }
  get human(): string { return this._human; }
  get id(): string { return this._id; }

  prop(propName: string): FieldSpec {
    let found = this._fieldSpecs.find(spec => spec.prop === propName);
    if (found == null) {
      throw new Error(`Cannot find field spec for an object property named ${propName} for table ${this.table}`);
    }
    return found;
  }

  column(column: string): FieldSpec {
    let found = this._fieldSpecs.find(spec => spec.column === column);
    if (found == null) {
      throw new Error(`Cannot find field spec for a database column named ${column} for table ${this.table}`);
    }
    return found;
  }

  propSupported(prop: string): boolean {
    return this._fieldSpecs.some(spec => spec.prop === prop);
  }

  columnSupported(column: string): boolean {
    return this._fieldSpecs.some(spec => spec.column === column);
  }

  rowToEntry<T>(row: { [name: string]: any }, completeObject?: { [name: string]: any }): T {
    let result: { [name: string]: any };
    if (completeObject != null) {
      result = completeObject;
    } else {
      result = {};
    }

    Object.keys(row).forEach(column => {
      if (this.columnSupported(column)) {
        let spec = this.column(column);
        result[spec.prop] = spec.fromDb(row[column]);
      }
    });

    return result as T;
  }
}

interface FieldSpec {
  prop: string;
  column: string;

  toDb(value: any): any;
  fromDb(value: any): any;

  validateToDb(value: any): void;
  validateFromDb(value: any): void;
}

class GenericFieldSpec implements FieldSpec {
  constructor(protected _prop: string, protected _column: string, protected _toDbValidator?: PropValidator,
              protected _fromDbValidator?: PropValidator, protected _toDb?: PropConvertor,
              protected _fromDb?: PropConvertor) { }

  get prop(): string { return this._prop; }
  get column(): string { return this._column; }

  toDb(value: any): any {
    this.validateToDb(value);
    if (this._toDb) {
      return this._toDb(value);
    } else {
      return value;
    }
  }

  fromDb(value: any): any {
    this.validateFromDb(value);
    if (this._fromDb) {
      return this._fromDb(value);
    } else {
      return value;
    }
  }

  validateToDb(value: any): void {
    if (this._toDbValidator) {
      if (!this._toDbValidator(value)) {
        throw new Error(`Invalid value for a property value "${this.prop}"`)
      }
    }
  }

  validateFromDb(value: any): void {
    if (this._fromDbValidator) {
      if (!this._fromDbValidator(value)) {
        throw new Error(`Invalid value for a database column "${this.column}"`);
      }
    }
  }
}

class UuidFieldSpec extends GenericFieldSpec {
  constructor(prop: string = 'uuid', column: string = 'uuid') {
    super(prop, column, PropValidators.OneOf(PropValidators.String, PropValidators.Empty), PropValidators.String);
  }
}

class DateFieldSpec extends GenericFieldSpec {
  constructor(prop: string, column: string) {
    super(prop, column, PropValidators.Date, PropValidators.Number)
  }

  toDb(value: any): any {
    this.validateToDb(value);
    return dateToTimestamp(value as Date);
  }

  fromDb(value: any): any {
    this.validateFromDb(value);
    return timestampToDate(value as number);
  }
}

class PublishDateSpec extends GenericFieldSpec {
  constructor(prop: string, column: string) {
    super(prop, column,
        PropValidators.OneOf(PropValidators.Date, PropValidators.String, PropValidators.Empty),
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty));
  }

  toDb(value: any): any {
    return value instanceof Date ? 'ts:' + dateToTimestamp(value) : value;
  }

  fromDb(value: any): any {
    if (typeof value === 'string') {
      if (value.startsWith('ts:')) {
        let ts = parseInt(value.slice(3), 10);
        return isNaN(ts) ? value : timestampToDate(ts);
      } else {
        return value;
      }
    } else {
      return null;
    }
  }
}

class GroupTypeFieldSpec extends GenericFieldSpec {
  constructor(prop: string, column: string, protected _db: LibraryDatabase) {
    super(prop, column);
  }

  validateToDb(value: any): void {
    if (value != null && ((typeof value === 'string' && value.length) ||
        (value.uuid != null && typeof value.uuid === 'string' && value.uuid.length > 0))) {
      return;
    }
    throw new Error(`Invalid value for a database column "${this.column}"`);
  }

  validateFromDb(value: any): void {
    if (typeof value === 'string' && value.length > 0) {
      return;
    }
    throw new Error(`Invalid value for a database column "${this.column}"`);
  }

  toDb(value: any): any {
    return (typeof value === 'string') ? value : value.uuid;
  }

  fromDb(value: any): any {
    return this._db.getGroupType(value);
  }
}

const ResourceSpec = new EntrySpec('resources', 'resource', [
    new UuidFieldSpec(),
    new GenericFieldSpec('title', 'title', PropValidators.String, PropValidators.String),
    new GenericFieldSpec('titleSort', 'title_sort', PropValidators.String, PropValidators.String),
    new GenericFieldSpec('rating', 'rating',
        PropValidators.OneOf(PropValidators.Empty,
              PropValidators.Both(PropValidators.Number, (value: any): boolean => value <= 500 && value >= 0)),
        PropValidators.OneOf(PropValidators.Empty,
            PropValidators.Both(PropValidators.Number, (value: any): boolean => value <= 500 && value >= 0))),
    new DateFieldSpec('addDate', 'add_date'),
    new DateFieldSpec('lastModifyDate', 'last_modify_date'),
    new PublishDateSpec('publishDate', 'publish_date'),
    new GenericFieldSpec('publisher', 'publisher',
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty),
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty)),
  new GenericFieldSpec('desc', 'desc',
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty),
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty))
]);

const PersonSpec = new EntrySpec('persons', 'person', [
    new UuidFieldSpec(),
    new GenericFieldSpec('name', 'name', PropValidators.String, PropValidators.String),
    new GenericFieldSpec('nameSort', 'name_sort', PropValidators.String, PropValidators.String)
]);

const ObjectSpec = new EntrySpec('objects', 'object', [
    new GenericFieldSpec('rowId', 'id', PropValidators.OneOf(PropValidators.Number, PropValidators.Empty),
        PropValidators.Number),
    new UuidFieldSpec('resourceUuid', 'res_id'),
    new UuidFieldSpec('uuid', 'uuid'),
    new GenericFieldSpec('role', 'role', PropValidators.Number, PropValidators.Number),
    new GenericFieldSpec('tag', 'tag', PropValidators.String, PropValidators.String),
], 'rowId');

const GroupTypeSpec = new EntrySpec('group_types', 'group type', [
    new UuidFieldSpec(),
    new GenericFieldSpec('name', 'name', PropValidators.String, PropValidators.String),
    new GenericFieldSpec('exclusive', 'exclusive', PropValidators.Boolean, PropValidators.Boolean),
    new GenericFieldSpec('ordered', 'ordered', PropValidators.Boolean, PropValidators.Boolean)
]);

const PersonRelationSpec = new EntrySpec('res_to_persons', 'person relation', [
    new GenericFieldSpec('relation', 'relation', PropValidators.Number, PropValidators.Number)
]);

const GroupRelationSpec = new EntrySpec('res_to_groups', 'group relation', [
  new GenericFieldSpec('groupIndex', 'group_index',
      PropValidators.OneOf(PropValidators.Number, PropValidators.Empty),
      PropValidators.Number,
      (value: any): any => value == null ? -1 : value,
      (value: any): any => value < 0 ? null : value),
    new GenericFieldSpec('relationTag', 'relation_tag',
        PropValidators.OneOf(PropValidators.String, PropValidators.Empty),
        PropValidators.String,
        (value: any): any => value == null ? '' : value,
        (value: any): any => value == null ? null : value)
]);

/**
 * This function only exists because of TypeScript bug preventing from using object spread operator in form
 * of 'return { ...obj, uuid: uuid }
 * https://github.com/Microsoft/TypeScript/issues/13557
 * As soon as the issue will be fixed, this function needs to be removed.
 */
function workaroundSpread(obj: { [name: string]: any }, uuid: string): any {
  let result: { [name: string]: any } = {};
  Object.keys(obj).forEach(prop => {
    result[prop] = obj[prop];
  });
  result.uuid = uuid;
  return result;
}

abstract class ClauseBuilder {
  abstract get clause(): string;

  add(column: string, value: any): void {
    this.addRaw(column + ' = ?', value);
  }

  addRaw(cond: string, value: any): void {
    this._list.push(cond);
    this._bound.push(value);
  }

  get bound(): any[] {
    return this._bound;
  }

  /** Protected area **/

  protected _list: string[] = [];
  protected _bound: any[] = [];
}

export class WhereClauseBuilder extends ClauseBuilder {
  get clause(): string {
    return this._list.join(' AND ');
  }
}

export class SetClauseBuilder extends ClauseBuilder {
  get clause(): string {
    return this._list.join(', ');
  }
}
