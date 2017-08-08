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
  title: string;

  /**
   * Much like a title, but is used to sort resources in alphabetic order.
   */
  titleSort: string;

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

/**
 * Any person that should be mentioned in library (author, translator or editor) is represented by such objects.
 */
export interface Person {
  uuid?: string|null;

  /**
   * Name of a person.
   */
  name: string;

  /**
   * Used instead of a name when sorting persons in alphabetical order.
   */
  nameSort: string;
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
  title: string;

  /**
   * Used instead of title when sorting groups in alphabetic order.
   */
  titleSort: string;

  /**
   * Type of this group.
   */
  groupType: GroupType;
}

/**
 * An extended version of a Group that mentions index a resource has in a group it relates to.
 */
export interface RelatedGroup extends Group {
  /**
   * Group index should be always positive or null. Any negative value will be ignored.
   */
  groupIndex: number|null;
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
  name: string;

  /**
   * If group is exclusive, a resource can be linked to only one group of this type. An example of an exclusive group type
   * is category type: a book cannot belong to two categories at same time. Tags are not exclusive and you can add
   * as much tags as you with to a single book.
   */
  exclusive: boolean;

  /**
   * If group is ordered, resources in the groups are ordered and you can specify an index of a resource has in
   * a group. An example of an ordered group is series type: each book in series has its number. But indexes are
   * optional, any resource can relate to an ordered group while omitting an index.
   */
  ordered: boolean;
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
              UNIQUE(res_id, group_id, group_index),
              FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT,
              FOREIGN KEY(group_id) REFERENCES groups(uuid) ON DELETE CASCADE ON UPDATE RESTRICT)`,
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
    if (uuid == null || uuid.length === 0) {
      throw new Error('Cannot find group type: invalid UUID');
    }

    uuid = uuid.toLowerCase().trim();
    let found = this._groupTypes.find(x => x.uuid === uuid);
    return found == null ? null : { ...found };
  }

  /**
   * Adds new group type into the library. If UUID is specified on gtData argument, registered type will have
   * the specified UUID, otherwise new one will be generated.
   * @param {GroupType} gtData GroupType object containing properties of the new group type.
   * @returns {Promise<GroupType>} GroupType object that has been added.
   */
  async addGroupType(gtData: GroupType): Promise<GroupType> {
    let typeUuid = gtData.uuid;
    if (typeUuid == null || typeUuid.length === 0) {
      typeUuid = uuid.v4();
    } else if (this.getGroupType(typeUuid) != null) {
      throw new Error(`Cannot add a group type with given UUID ${gtData.uuid}: type already exists`);
    }

    await this.db.run("INSERT INTO group_types(uuid, name, exclusive, ordered) VALUES(?, ?, ?, ?)", [
        typeUuid.toLowerCase(), gtData.name, gtData.exclusive, gtData.ordered
    ]);

    this._groupTypes.push({ ...gtData, uuid: typeUuid });
    return { ...gtData, uuid: typeUuid };
  }

  /**
   * Removes group type from the library. If no type with given UUID exists, the function will fail.
   * @param {string} uuid UUID of the GroupType object to remove
   * @returns {Promise<void>}
   */
  async removeGroupType(uuid: string) : Promise<void> {
    if (uuid == null || uuid.length === 0) {
      throw new Error('Cannot remove group type: invalid UUID');
    }
    uuid = uuid.toLowerCase().trim();

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === uuid.toLowerCase());
    if (typeIndex < 0) {
      throw new Error('Cannot remove group type: type does not exist');
    }

    await this.db.run("DELETE FROM group_types WHERE uuid = ?", [ uuid.toLowerCase() ]);

    this._groupTypes.splice(typeIndex, 1);
  }

  /**
   * Change an existing group type.
   * @param {GroupType} gt GroupType object with new properties for this type. This object must have UUID specified,
   * otherwise the function will fail.
   * @returns {Promise<GroupType>} Updated GroupType object. Note that this is a new object, not one you've passed
   * as an argument.
   */
  async updateGroupType(gt: GroupType): Promise<GroupType> {
    let uuid = Database._validateId(gt.uuid);

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === uuid);
    if (typeIndex < 0) {
      throw new Error('Cannot update group type: type does not exist');
    }

    await this.db.run("UPDATE group_types SET name = ?, exclusive = ?, ordered = ? WHERE uuid = ?", [
        gt.name, gt.exclusive, gt.ordered, gt.uuid
    ]);

    this._groupTypes[typeIndex] = { ...gt, uuid: uuid };
    return { ...gt, uuid: uuid };
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
  addResource(res: Resource): Promise<Resource> {
    let curDate = new Date();
    return this._addEntry({ ...res, addDate: curDate, lastModifyDate: curDate }, ResourceSpec);
  }

  /**
   * Change an existing resource.
   * @param {Resource} res Resource object with new properties for this resource. This object must have UUID specified,
   * otherwise the function will fail.
   * @returns {Promise<Resource>} Updated Resource object. Note that this is a new object, not one you've passed
   * as an argument.
   */
  updateResource(res: Resource): Promise<Resource> {
    let curDate = new Date();
    return this._updateEntry({ ...res, lastModifyDate: curDate, addDate: undefined }, ResourceSpec,
        [ 'addDate' ]);
  }

  /**
   * Remove resource from the library. If no resource with given UUID exists, the function will fail.
   * @param {string} uuid UUID of the resource to remove
   * @returns {Promise<void>}
   */
  removeResource(uuid: string): Promise<void> {
    return this._removeEntry(uuid, ResourceSpec);
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
  addPerson(pers: Person): Promise<Person> {
    return this._addEntry(pers, PersonSpec);
  }

  /**
   * Change an existing person.
   * @param {Resource} pers Person object with new properties for this person. This object must have UUID specified,
   * otherwise the function will fail.
   * @returns {Promise<Person>} Updated Person object. Note that this is a new object, not one you've passed
   * as an argument.
   */
  updatePerson(pers: Person): Promise<Person> {
    return this._updateEntry(pers, PersonSpec);
  }

  /**
   * Remove person from the library. If no perosn with given UUID exists, the function will fail.
   * @param {string} uuid UUID of the person to remove
   * @returns {Promise<void>}
   */
  removePerson(uuid: string): Promise<void> {
    return this._removeEntry(uuid, PersonSpec);
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
  addGroup(group: Group): Promise<Group> {
    return this._addEntry(group, this._groupSpec);
  }

  /**
   * Change an existing group.
   * @param {Resource} group Group object with new properties for this group. This object must have UUID specified,
   * otherwise the function will fail.
   * @returns {Promise<Group>} Updated Group object. Note that this is a new object, not one you've passed
   * as an argument.
   */
  updateGroup(group: Group): Promise<Group> {
    return this._updateEntry(group, this._groupSpec);
  }

  /**
   * Remove group from the library. If no group with given UUID exists, the function will fail.
   * @param {string} uuid UUID of the group to remove
   * @returns {Promise<void>}
   */
  removeGroup(uuid: string): Promise<void> {
    return this._removeEntry(uuid, this._groupSpec);
  }

  /**
   * Create a relation between a resource and person.
   * @param {string} resource UUID of a resource
   * @param {string} person UUID of a person
   * @param {PersonRelation} relation Type of relation to create
   * @returns {Promise<void>}
   */
  async addPersonRelation(resource: string, person: string, relation: PersonRelation): Promise<void> {
    resource = Database._validateId(resource);
    person = Database._validateId(person);

    await this.db.run("INSERT INTO res_to_persons(res_id, person_id, relation) VALUES(?, ?, ?)",
        [ resource, person, relation ]);
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
  async removePersonRelations(resource: string, person?: string, relation?: PersonRelation): Promise<void> {
    let whereList: string[] = ['res_id'], bound: any[] = [ Database._validateId(resource) ];
    if (person != null) {
      whereList.push('person_id');
      bound.push(Database._validateId(person));
    }
    if (relation != null) {
      whereList.push('relation');
      bound.push(relation);
    }

    let whereClause = whereList.map(x => x + ' = ?').join(' AND ');

    await this.db.run(`DELETE FROM res_to_persons WHERE ${whereClause}`, bound);
  }

  /**
   * Get a list of persons this resource relates to.
   * @param {string} resource UUID of a resource
   * @param {PersonRelation} relation Type of relations you are interested in. If not specified, all relations
   * will be returned.
   * @returns {Promise<RelatedPerson[]>} List of relations between persons and this resource.
   */
  async relatedPersons(resource: string, relation?: PersonRelation): Promise<RelatedPerson[]> {
    resource = Database._validateId(resource);

    let whereClause: string, bound: any[];
    if (relation == null) {
      whereClause = 'res_id = ?';
      bound = [resource];
    } else {
      whereClause = 'res_id = ? AND relation = ?';
      bound = [resource, relation];
    }

    let rows: { relation: number, uuid: string, name: string, name_sort: string }[] = await this.db.all(
        `SELECT relation, uuid, name, name_sort FROM res_to_persons LEFT JOIN persons ON res_to_persons.person_id = persons.uuid WHERE ${whereClause}`,
        bound);

    let results: RelatedPerson[] = [];
    for (let row of rows) {
      let person = PersonSpec.rowToEntry<RelatedPerson>(row);
      person.relation = row.relation as PersonRelation;
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
   * @returns {Promise<RelatedGroup>} Relation that has been created
   */
  async addGroupRelation(resource: string, groupUuid: string, groupIndex?: number): Promise<RelatedGroup> {
    resource = Database._validateId(resource);
    groupUuid = Database._validateId(groupUuid);

    let group = await this.getGroup(groupUuid);
    if (group == null) {
      throw new Error(`Cannot add relation to group with UUID = ${groupUuid}: no such group exists`);
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

    await this.db.run("INSERT INTO res_to_groups(res_id, group_id, group_index) VALUES(?, ?, ?)",
        [ resource, groupUuid, groupIndex == null ? -1 : groupIndex ]);

    let relGroup: RelatedGroup = group as RelatedGroup;
    relGroup.groupIndex = groupIndex == null ? null : groupIndex;
    return relGroup;
  }

  /**
   * Removes existing relation (or relations) between a resource and a group. If no relations exist, the function
   * will do nothing. Call it with the only first argument to remove all group relations for a resource.
   * @param {string} resource UUID of a resource
   * @param {string} group UUID of a group. If specified, only relations between the resource and this group are going
   * to be removed (taking {@link groupType} into account, of course).
   * @param {GroupType} groupType If specified, only relations between the resource and groups with given type are
   * going to be removed.
   * @returns {Promise<void>}
   */
  async removeGroupRelations(resource: string, group?: string, groupType?: GroupType): Promise<void> {
    let whereList: string[] = ['res_id = ?'], bound: any[] = [Database._validateId(resource)];
    if (group != null) {
      whereList.push('group_id = ?');
      bound.push(Database._validateId(group));
    }
    if (groupType != null) {
      whereList.push('group_id IN (SELECT uuid FROM groups WHERE type = ?)');
      bound.push(groupType.uuid);
    }

    let whereClause = whereList.join(' AND ');

    await this.db.run(`DELETE FROM res_to_groups WHERE ${whereClause}`, bound);
  }

  /**
   * Get a list of groups a resource relates to.
   * @param {string} resource UUID of a resource
   * @param {GroupType} groupType If specified, only relations with groups of the specified type will be returned.
   * If not specified, all relations regardless of type will be returned.
   * @returns {Promise<RelatedGroup[]>}
   */
  async relatedGroups(resource: string, groupType?: GroupType): Promise<RelatedGroup[]> {
    let whereList: string[] = ['res_id = ?'],
        bound: any[] = [Database._validateId(resource)];

    if (groupType != null) {
      whereList.push('group_id IN (SELECT uuid FROM groups WHERE type = ?)');
      bound.push(groupType.uuid);
    }

    let whereClause = whereList.join(' AND ');

    let rows: { group_id: string, group_index: number, type: string, title: string, title_sort: string }[] =
        await this.db.all(`SELECT group_index, uuid, type, title, title_sort FROM res_to_groups ` +
        `LEFT JOIN groups ON res_to_groups.group_id = groups.uuid WHERE ${whereClause}`,
        bound);

    let results: RelatedGroup[] = [];
    for (let row of rows) {
      let group = this._groupSpec.rowToEntry<RelatedGroup>(row);
      group.groupIndex = row.group_index == null || row.group_index < 0 ? null : row.group_index;
      results.push(group);
    }

    return results;
  }

  /** Protected area **/

  protected _groupTypes: GroupType[] = [];

  protected _groupSpec = new EntrySpec('groups', 'group', {
    title: 'title',
    titleSort: 'title_sort',
    groupType: 'type'
  }, {
    groupType: (groupType: string) => this.getGroupType(groupType)
  }, {
    groupType: (groupType: GroupType) => groupType.uuid
  }, {
    title: PropValidators.String,
    titleSort: PropValidators.String,
    groupType: (value: any): boolean => {
      return value != null && value.uuid != null && typeof value.uuid === 'string' && value.uuid.length > 0
    }
  }, {
    title: PropValidators.String,
    titleSort: PropValidators.String,
    groupType: (value: any): boolean => typeof value === 'string' && value.length > 0
  });

  protected async _loadGroupTypes(): Promise<void> {
    let types = await this.db.all<{ uuid: string, name: string, exclusive: number, ordered: number}>
                  ("SELECT uuid, name, exclusive, ordered FROM group_types");
    this._groupTypes = types.map(item => {
      return {
        uuid: item.uuid.toLowerCase(),
        name: item.name,
        exclusive: !!item.exclusive,
        ordered: !!item.ordered
      }
    });
  }

  protected async _getEntry<T>(uuid: string, spec: EntrySpec): Promise<T|null> {
    if (uuid == null || uuid.length === 0) {
      throw new Error(`Cannot find ${spec.human}: invalid UUID`);
    }
    uuid = uuid.toLowerCase().trim();

    let row: { [prop: string]: any }|null = await this.db.get(`SELECT * FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
    if (row == null) {
      return null;
    }

    let entry = spec.rowToEntry<T>(row);
    (entry as any).uuid = uuid;
    return entry;
  }

  protected async _updateEntry<T extends { uuid?: string|null } & { [name: string]: any }>
                  (entry: T, spec: EntrySpec, propsToIgnore?: string[]): Promise<T> {
    if (entry.uuid == null || entry.uuid.length === 0) {
      throw new Error(`Cannot update ${spec.human}: invalid UUID`);
    }
    let entryUuid = entry.uuid.toLowerCase().trim();

    let mappings = spec.getMappings();
    if (mappings.length === 0) {
      throw new Error(`Invalid entry spec for ${spec.human}`);
    }

    if (propsToIgnore != null) {
      mappings = mappings.filter(item => propsToIgnore.indexOf(item.prop) < 0);
    }

    let setClause = mappings.map(item => item.column + ' = ?').join(', ');

    let bound = mappings.map(item => spec.valueToDb(entry[item.prop], item.prop));
    bound.push(entryUuid);

    let stmt = await this.db.run(`UPDATE ${spec.table} SET ${setClause} WHERE uuid = ?`, bound);

    if (stmt.changes === 0) {
      throw new Error(`Cannot update ${spec.human}: no entry with given UUID have been found`);
    }

    return workaroundSpread(entry, entryUuid);
  }

  protected async _addEntry<T extends { uuid?: string|null } & { [name: string]: any }>(entry: T, spec: EntrySpec): Promise<T> {
    let entryUuid: string;
    if (entry.uuid == null || entry.uuid.length === 0) {
      entryUuid = uuid.v4().toLowerCase();
    } else {
      entryUuid = entry.uuid.toLowerCase().trim();
    }

    let mappings = spec.getMappings();
    if (mappings.length === 0) {
      throw new Error(`Invalid entry spec for ${spec.human}`);
    }

    let intoClause = 'uuid, ' + mappings.map(item => item.column).join(', ');
    let valuesClause = (new Array(mappings.length + 1)).fill('?').join(', ');

    let bound = mappings.map(item => spec.valueToDb(entry[item.prop], item.prop));
    bound.unshift(entryUuid);

    await this.db.run(`INSERT INTO ${spec.table}(${intoClause}) VALUES(${valuesClause})`, bound);

    return workaroundSpread(entry, entryUuid);
  }

  protected async _removeEntry<T>(uuid: string, spec: EntrySpec): Promise<void> {
    if (uuid == null || uuid.length === 0) {
      throw new Error(`Cannot remove ${spec.human}: invalid UUID`);
    }
    uuid = uuid.toLowerCase().trim();

    await this.db.run(`DELETE FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
  }
}

class EntrySpec {
  constructor(public table: string, public human: string,
              protected _mappings: { [name: string]: string },
              protected _fromDbHandlers: { [name: string]: (value: any) => any },
              protected _toDbHandlers: { [name: string]: (value: any) => any},
              protected _toDbValidators: { [name: string]: PropValidator },
              protected _fromDbValidators: { [name: string]: PropValidator }
              ) { }

  propToColumnName(prop: string): string {
    if (prop === 'uuid') {
      return 'uuid';
    }
    if (this._mappings[prop] == null) {
      throw new Error(`Cannot map property ${prop} to any database column name`);
    } else {
      return this._mappings[prop];
    }
  }

  columnToPropName(column: string): string {
    if (column === 'uuid') {
      return 'uuid';
    }
    let found = Object.keys(this._mappings).find(prop => this._mappings[prop] === column);
    if (found == null) {
      throw new Error(`Cannot map database column name ${column} to any property`);
    } else {
      return found;
    }
  }

  columnSupported(column: string): boolean {
    return column === 'uuid' || Object.keys(this._mappings).some(prop => this._mappings[prop] === column);
  }

  valueFromDb(value: any, columnName: string): any {
    let propName = this.columnToPropName(columnName);
    if (!this.validateFromDb(value, propName)) {
      throw new Error(`Database value is invalid: ${value}`);
    }
    return this._fromDbHandlers[propName] == null ? value : this._fromDbHandlers[propName](value);
  }

  valueToDb(value: any, propName: string): any {
    if (!this.validateToDb(value, propName)) {
      throw new Error(`Value for property ${propName} is invalid: ${value}`);
    }
    return this._toDbHandlers[propName] == null ? value : this._toDbHandlers[propName](value);
  }

  rowToEntry<T>(row: { [name: string]: any }): T {
    let result: { [name: string]: any } = {};
    Object.keys(row).forEach(columnName => {
      if (this.columnSupported(columnName)) {
        result[this.columnToPropName(columnName)] = this.valueFromDb(row[columnName], columnName);
      }
    });
    return result as T;
  }

  getMappings(): { prop: string, column: string }[] {
    return Object.keys(this._mappings).map(propName => {
      return {
        prop: propName,
        column: this.propToColumnName(propName)
      }
    });
  }

  validateToDb(value: any, propName: string): boolean {
    if (this._toDbValidators[propName] == null) {
      return true;
    } else {
      return this._toDbValidators[propName](value);
    }
  }

  validateFromDb(value: any, propName: string): boolean {
    if (this._fromDbValidators[propName] == null) {
      return true;
    } else {
      return this._fromDbValidators[propName](value);
    }
  }
}

type PropValidator = (value: any) => boolean;

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

const ResourceSpec = new EntrySpec('resources', 'resource', {
  title: 'title',
  titleSort: 'title_sort',
  rating: 'rating',
  addDate: 'add_date',
  lastModifyDate: 'last_modify_date',
  publishDate: 'publish_date',
  publisher: 'publisher',
  desc: 'desc'
}, { // from database
  addDate: timestampToDate,
  lastModifyDate: timestampToDate,
  publishDate: (value: string): string|Date|null => {
    if (value == null) {
      return null;
    }
    if (value.startsWith('ts:')) {
      let ts = parseInt(value.slice(3), 10);
      return isNaN(ts) ? value : timestampToDate(ts);
    } else {
      return value;
    }
  }
}, { // to database
  addDate: dateToTimestamp,
  lastModifyDate: dateToTimestamp,
  publishDate: (value: string|Date): string => (value instanceof Date ? 'ts:' + dateToTimestamp(value) : value)
}, {
  title: PropValidators.String,
  titleSort: PropValidators.String,
  rating: PropValidators.OneOf(PropValidators.Empty,
      PropValidators.Both(PropValidators.Number, (value: any): boolean => value <= 500 && value >= 0)),
  addDate: PropValidators.Date,
  lastModifyDate: PropValidators.Date,
  publishDate: PropValidators.OneOf(PropValidators.Date, PropValidators.String, PropValidators.Empty),
  publisher: PropValidators.OneOf(PropValidators.String, PropValidators.Empty),
  desc: PropValidators.OneOf(PropValidators.String, PropValidators.Empty)
}, {
  title: PropValidators.String,
  titleSort: PropValidators.String,
  rating: PropValidators.OneOf(PropValidators.Empty,
      PropValidators.Both(PropValidators.Number, (value: any): boolean => value <= 500 && value >= 0)),
  addDate: PropValidators.Number,
  lastModifyDate: PropValidators.Number,
  publishDate: PropValidators.OneOf(PropValidators.String, PropValidators.Number, PropValidators.Empty),
  publisher: PropValidators.OneOf(PropValidators.String, PropValidators.Empty),
  desc: PropValidators.OneOf(PropValidators.String, PropValidators.Empty)
});

const PersonSpec = new EntrySpec('persons', 'person', {
  name: 'name',
  nameSort: 'name_sort'
}, {}, {}, {
  name: PropValidators.String,
  nameSort: PropValidators.String
}, {
  name: PropValidators.String,
  nameSort: PropValidators.String
});

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
