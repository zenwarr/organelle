import {Database, DatabaseWithOptions} from './db';
import * as uuid from 'uuid';

export const CUR_LIBRARY_VERSION = 1;

export interface GroupType {
  uuid: string|null;
  name: string;
  exclusive: boolean;
  indexable: boolean;
}

export enum KnownGroupTypes {
  Tags = '0385ee32-fb86-475c-8d93-b1f0590cb089',
  Series = '509d7919-5462-4687-89b4-97afebcac3eb',
  Categories = '77c0939e-4dcc-4d30-a528-8385a3ce96e3',
  Languages = '2dbbbec1-80c0-4be6-a55f-90d3586b3282'
}

const KNOWN_GROUP_TYPES_DATA: GroupType[] = [
  {
    uuid: KnownGroupTypes.Tags,
    name: 'tags',
    exclusive: true,
    indexable: false
  },
  {
    uuid: KnownGroupTypes.Series,
    name: 'series',
    exclusive: false,
    indexable: true
  },
  {
    uuid: KnownGroupTypes.Categories,
    name: 'category',
    exclusive: true,
    indexable: false
  },
  {
    uuid: KnownGroupTypes.Languages,
    name: 'language',
    exclusive: false,
    indexable: false
  }
];

export interface Resource {
  uuid: string|null;
  title: string;
  titleSort: string;
  rating: number;
  addDate: Date;
  lastModifyDate: Date;
  publishDate: string;
  publisher: string;
  desc: string;
}

export interface Person {
  uuid: string|null;
  name: string;
  nameSort: string;
}

export interface Group {
  uuid: string|null;
  title: string;
  titleSort: string;
  groupType: GroupType;
}

interface ResourceEntry {
  title: string;
  title_sort: string;
  rating: number;
  add_date: number;
  last_modify_date: number;
  publish_date: string;
  publisher: string;
  desc: string;
}

export class LibraryDatabase extends DatabaseWithOptions {
  constructor(filename: string) {
    super(filename, CUR_LIBRARY_VERSION);
  }

  async create(): Promise<void> {
    await super.create();

    const SCHEMA: string[] = [
        `CREATE TABLE resources(uuid TEXT PRIMARY KEY, title TEXT, title_sort TEXT, rating SMALLINT, 
              add_date DATETIME, last_modify_date DATETIME, publish_date TEXT, publisher TEXT, desc TEXT)`,
        `CREATE TABLE persons(uuid TEXT PRIMARY KEY, name TEXT, name_sort TEXT)`,
        `CREATE TABLE resources_to_persons(res_id TEXT, person_id TEXT, relation INTEGER,
              FOREIGN KEY(res_id) REFERENCES resources(uuid),
              FOREIGN KEY(person_id) REFERENCES persons(uuid))`,
        `CREATE TABLE group_types(uuid TEXT PRIMARY KEY, name TEXT, exclusive BOOLEAN, indexable BOOLEAN)`,
        `CREATE TABLE groups(uuid TEXT PRIMARY KEY, type TEXT, title TEXT, title_sort TEXT,
              FOREIGN KEY(type) REFERENCES group_types(uuid))`,
        `CREATE TABLE resources_to_groups(res_id TEXT, group_id TEXT, group_index INTEGER,
              FOREIGN KEY(res_id) REFERENCES resources(uuid),
              FOREIGN KEY(group_id) REFERENCES series(uuid))`,
    ];

    for (let query of SCHEMA) {
      await this.db.run(query);
    }

    // add known groups
    let stmt = await this.db.prepare("INSERT INTO group_types(uuid, name, exclusive, indexable) VALUES(?, ?, ?, ?)");
    try {
      for (let gd of KNOWN_GROUP_TYPES_DATA) {
        stmt.run(gd.uuid, gd.name, gd.exclusive, gd.indexable);
      }
    } finally {
      stmt.finalize();
    }

    // and copy these known groups to group types
    this._groupTypes = KNOWN_GROUP_TYPES_DATA.map(x => x);
  }

  getGroupType(uuid: string) {
    if (uuid == null || uuid.length === 0) {
      throw new Error('Cannot find group type: invalid UUID');
    }

    uuid = uuid.toLowerCase().trim();
    let found = this._groupTypes.find(x => x.uuid === uuid);
    return found == null ? null : { ...found };
  }

  async addGroupType(gtData: GroupType): Promise<GroupType> {
    let typeUuid = gtData.uuid;
    if (typeUuid == null || typeUuid.length === 0) {
      typeUuid = uuid.v4();
    } else if (this.getGroupType(typeUuid) != null) {
      throw new Error(`Cannot add a group type with given UUID ${gtData.uuid}: type already exists`);
    }

    await this.db.run("INSERT INTO group_types(uuid, name, exclusive, indexable) VALUES(?, ?, ?, ?)", [
        typeUuid.toLowerCase(), gtData.name, gtData.exclusive, gtData.indexable
    ]);

    this._groupTypes.push({ ...gtData, uuid: typeUuid });
    return { ...gtData, uuid: typeUuid };
  }

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

  async updateGroupType(gt: GroupType): Promise<GroupType> {
    if (gt.uuid == null || gt.uuid.length === 0) {
      throw new Error('Cannot update type group: invalid UUID');
    }
    let uuid = gt.uuid.toLowerCase().trim();

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === uuid);
    if (typeIndex < 0) {
      throw new Error('Cannot update group type: type does not exist');
    }

    await this.db.run("UPDATE group_types SET name = ?, exclusive = ?, indexable = ? WHERE uuid = ?", [
        gt.name, gt.exclusive, gt.indexable, gt.uuid
    ]);

    this._groupTypes[typeIndex] = { ...gt, uuid: uuid };
    return { ...gt, uuid: uuid };
  }

  getResource(uuid: string): Promise<Resource|null> {
    return this._getEntry<Resource>(uuid, ResourceSpec);
  }

  addResource(res: Resource): Promise<Resource> {
    return this._addEntry(res, ResourceSpec);
  }

  updateResource(res: Resource): Promise<Resource> {
    return this._updateEntry(res, ResourceSpec);
  }

  removeResource(uuid: string): Promise<void> {
    return this._removeEntry(uuid, ResourceSpec);
  }

  getPerson(uuid: string): Promise<Person|null> {
    return this._getEntry(uuid, PersonSpec);
  }

  addPerson(pers: Person): Promise<Person> {
    return this._addEntry(pers, PersonSpec);
  }

  updatePerson(pers: Person): Promise<Person> {
    return this._updateEntry(pers, PersonSpec);
  }

  removePerson(uuid: string): Promise<void> {
    return this._removeEntry(uuid, PersonSpec);
  }

  /** Protected area **/

  _groupTypes: GroupType[] = [];

  protected async _loadGroupTypes(): Promise<void> {
    let types = await this.db.all<{ uuid: string, name: string, exclusive: number, indexable: number}>
                  ("SELECT uuid, name, exclusive, indexable FROM group_types");
    this._groupTypes = types.map(item => {
      return {
        uuid: item.uuid.toLowerCase(),
        name: item.name,
        exclusive: !!item.exclusive,
        indexable: !!item.indexable
      }
    });
  }

  async _getEntry<T>(uuid: string, spec: EntrySpec): Promise<T|null> {
    if (uuid == null || uuid.length === 0) {
      throw new Error(`Cannot find ${spec.human}: invalid UUID`);
    }
    uuid = uuid.toLowerCase().trim();

    let row: { [prop: string]: any }|null = await this.db.get(`SELECT * FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
    if (row == null) {
      return null;
    }

    let entry = {};
    spec.rowToEntry(row, uuid, entry);
    return entry as T;
  }

  async _updateEntry<T extends { uuid: string|null } & { [name: string]: any }>(entry: T, spec: EntrySpec): Promise<T> {
    if (entry.uuid == null || entry.uuid.length === 0) {
      throw new Error(`Cannot update ${spec.human}: invalid UUID`);
    }
    let entryUuid = entry.uuid.toLowerCase().trim();

    let mappings = spec.getMappings();
    if (mappings.length === 0) {
      throw new Error(`Invalid entry spec for ${spec.human}`);
    }

    let setClause = mappings.map(item => item.column).join(' = ?, ') + ' = ?';

    let bound = mappings.map(item => spec.valueToDb(entry[item.prop], item.prop));
    bound.push(entryUuid);

    let stmt = await this.db.run(`UPDATE ${spec.table} SET ${setClause} WHERE uuid = ?`, bound);

    if (stmt.changes === 0) {
      throw new Error(`Cannot update ${spec.human}: no entry with given UUID have been found`);
    }

    return workaroundSpread(entry, entryUuid);
  }

  async _addEntry<T extends { uuid: string|null } & { [name: string]: any }>(entry: T, spec: EntrySpec): Promise<T> {
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

  async _removeEntry<T>(uuid: string, spec: EntrySpec): Promise<void> {
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
              protected _toDbHandlers: { [name: string]: (value: any) => any }
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

  valueFromDb(value: any, columnName: string): any {
    let propName = this.columnToPropName(columnName);
    return this._fromDbHandlers[propName] == null ? value : this._fromDbHandlers[propName](value);
  }

  valueToDb(value: any, propName: string): any {
    return this._toDbHandlers[propName] == null ? value : this._toDbHandlers[propName](value);
  }

  rowToEntry<T extends { [name: string]: string }>(row: { [name: string]: any }, entryUuid: string|null, result: T): T {
    Object.keys(row).forEach(columnName => {
      result[this.columnToPropName(columnName)] = this.valueFromDb(row[columnName], columnName);
    });
    if (entryUuid != null) {
      result['uuid'] = entryUuid;
    }
    return result;
  }

  getMappings(): { prop: string, column: string }[] {
    return Object.keys(this._mappings).map(propName => {
      return {
        prop: propName,
        column: this.propToColumnName(propName)
      }
    });
  }
}

function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

function dateToTimestamp(date: Date): number {
  return Math.round(date.getTime() / 1000);
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
}, {
  addDate: timestampToDate,
  lastModifyDate: timestampToDate
}, {
  addDate: dateToTimestamp,
  lastModifyDate: dateToTimestamp
});

const PersonSpec = new EntrySpec('persons', 'person', {
  name: 'name',
  nameSort: 'name_sort'
}, {}, {});

/**
 * This function is only exists because of TypeScript bug preventing from using object spread operator in form
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
