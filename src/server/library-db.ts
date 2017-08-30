import {Database, DatabaseWithOptions} from './db';
import * as uuid from 'uuid';
import {dateToTimestamp, timestampToDate} from "./common";
import {schema} from "./schema";
import {
  ExistingGroupType, ExistingResource, KnownGroupTypes, NewGroupType, NewResource, PersonRelation,
  UpdateGroupType, UpdateResource, ExistingPerson, NewPerson, UpdatePerson, ExistingGroup, NewGroup, UpdateGroup,
  RelatedPerson, RelatedGroup, ObjectRole, ExistingRelatedObject, NewRelatedObject, UpdateRelatedObject,
  AbstractDbObject
} from "../common/db";

export const CUR_LIBRARY_VERSION = 1;

const KNOWN_GROUP_TYPES_DATA: ExistingGroupType[] = [
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
    name: 'categories',
    exclusive: true,
    ordered: false
  },
  {
    uuid: KnownGroupTypes.Language,
    name: 'langs',
    exclusive: false,
    ordered: false
  }
];

export enum SortMode {
  Asc,
  Desc
}

export interface SortProp {
  propName: string;
  sortMode?: SortMode;
}

/**
 * Object describing sorting and pagination options.
 */
export interface ListOptions {
  /**
   * Zero-based offset of the first item in results to return.
   */
  offset?: number;

  /**
   * Max number of items to return.
   */
  maxCount?: number;

  /**
   * Sorting options.
   * Each item is this array describes which properties should be used for sorting.
   * By default, items are sorted by some default property: resources are sorted by titleSort, persons — by titleSort, etc.
   * These options are applied in the same order as they come in the array: first item is going to be in the first ORDER BY, second one is going to be the second, etc.
   * Default sorting property will come after all the properties in this array.
   * But if you've already explicitly used the default sorting property in the list, it will not be appended.
   */
  sortProps?: SortProp[];

  /**
   * Order for default sorting.
   * This order is applied to default sort property (in case there are no sortProps or default sort property is automatically appended to sortProps)
   */
  prefSortMode?: SortMode;
}

export enum Operator {
  Equal,
  And,
  Or,
  HasRelationWith
}

export class Criterion {
  public args: any[];
  public fixedArgCount: number|null = null;

  constructor(public op: Operator, ...args: any[]) {
    this.args = [ ...args ];
  }
}

export class CriterionEqual extends Criterion {
  constructor(prop: string, value: any) {
    super(Operator.Equal, new CriterionProp(prop), value);
    this.fixedArgCount = 2;
  }
}

export class CriterionHasRelationWith extends Criterion {
  constructor(criterion: Criterion) {
    super(Operator.HasRelationWith, criterion);
    this.fixedArgCount = 1;
  }
}

export class CriterionOr extends Criterion {
  constructor(...args: Criterion[]) {
    super(Operator.Or, ...args);
  }
}

export class CriterionAnd extends Criterion {
  constructor(...args: Criterion[]) {
    super(Operator.And, ...args);
  }
}

export class CriterionProp {
  constructor(public prop: string) { }
}

export class LibraryDatabase extends DatabaseWithOptions {
  constructor(filename: string) {
    super(filename, CUR_LIBRARY_VERSION);
  }

  async create(): Promise<void> {
    await super.create();

    await this.db.exec(schema);

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
   * @returns {ExistingGroupType|null} GroupType object for the type or null if type has not been found.
   */
  getGroupType(uuid: string): ExistingGroupType|null {
    uuid = Database.validateId(uuid);
    let found = this._groupTypes.find(x => x.uuid === uuid);
    return found == null ? null : { ...found };
  }

  getKnownGroupType(uuid: string): ExistingGroupType {
    let gt = this.getGroupType(uuid);
    if (!gt) {
      throw new Error(`Library does not support known group type with UUID = ${uuid}`);
    }
    return gt;
  }

  getGroupTypeByName(name: string): ExistingGroupType|null {
    name = name.toLowerCase().trim();
    let found = this._groupTypes.find(x => (x.name as string).toLowerCase() === name);
    return found == null ? null : { ...found };
  }

  /**
   * Adds new group type into the library. If UUID is specified on gtData argument, registered type will have
   * the specified UUID, otherwise new one will be generated.
   * @param {NewGroupType} gtData GroupType object containing properties of the new group type.
   * @returns {Promise<ExistingGroupType>} GroupType object that has been added.
   */
  async addGroupType(gtData: NewGroupType): Promise<ExistingGroupType> {
    let createdType = await this._addEntry<NewGroupType, ExistingGroupType>(gtData, GroupTypeSpec);
    this._groupTypes.push({ ...createdType });
    return createdType;
  }

  /**
   * Removes group type from the library. If no type with given UUID exists, the function will fail.
   * @param {string} groupType UUID of the GroupType object to remove
   * @returns {Promise<void>}
   */
  async removeGroupType(groupType: UpdateGroupType|string) : Promise<void> {
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
   * @param {UpdateGroupType} gt GroupType object with new properties for this type. This object must have UUID specified,
   * otherwise the function will fail.
   */
  async updateGroupType(gt: UpdateGroupType): Promise<void> {
    let uuid = Database.validateId(gt.uuid);

    let typeIndex = this._groupTypes.findIndex(x => x.uuid === uuid);
    if (typeIndex < 0) {
      throw new Error('Cannot update group type: type does not exist');
    }

    await this._updateEntry(gt, GroupTypeSpec);

    let updatedGroupType = { ...this._groupTypes[typeIndex] };
    for (let key of Object.keys(gt)) {
      if ((gt as any)[key] != null) {
        (updatedGroupType as any)[key] = (gt as any)[key];
      }
    }
    this._groupTypes[typeIndex] = updatedGroupType;
  }

  /**
   * Get a resource with given UUID.
   * @param {string} uuid UUID of the resource to find.
   * @returns {Promise<Resource|null>} Resource object for the type or null of resource has not been found.
   */
  getResource(uuid: string): Promise<ExistingResource|null> {
    return this._getEntry<ExistingResource>(uuid, ResourceSpec);
  }

  /**
   * Add a new resource. If UUID is specified on res argument, registered resource will have the specified UUID,
   * otherwise new one will be generated.
   * @param {NewResource} res Resource object containing properties of the new resource.
   * @returns {Promise<ExistingResource>} Resource object that has been added.
   */
  addResource(res: NewResource): Promise<ExistingResource> {
    let curDate = new Date();
    return this._addEntry<NewResource, ExistingResource>({ ...res, addDate: curDate, lastModifyDate: curDate }, ResourceSpec);
  }

  /**
   * Change an existing resource.
   * @param {UpdateResource} res Resource object with new properties for this resource. This object must have UUID specified,
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
  removeResource(resource: UpdateResource|string): Promise<void> {
    return this._removeEntry(Database.getId(resource), ResourceSpec);
  }

  /**
   * Get list of resources with a specific name.
   * @param title Title to search for
   * @param {ListOptions} options Sorting and pagination options
   * @returns {Promise<ExistingResource[]>} List of resources matching the request.
   */
  async findResources(title?: string, options?: ListOptions): Promise<ExistingResource[]> {
    let crit = title == null ? undefined : new CriterionOr(
        new CriterionEqual('title', title),
        new CriterionEqual('titleSort', title)
    );

    return this.findResourcesByCriteria(crit, options);
  }

  /**
   * Get list of resources matching given criteria.
   * It is possible to sort matched resources not only by title and other field of Resource object, but by foreign keys.
   * For example, it is possible to sort resource by author.
   * You can do it by providing values in a special form to options.sortProps.propName.
   * To sort resource by author name, you can just give "authors" as value for options.sortProps.propName, and resources will be sorted by nameSort property of related authors.
   * Resources that have multiple authors, are going to be properly sorted: only author that comes first in alphabetical order will be taken into account while sorting resources in ascending order.
   * You can also sort resources by properties of related persons or groups.
   * For example: groups#relationTag is going to sort resources by relationTag of linked groups.
   * When part after hash sign (#) is missing, default sorting for the table will be used.
   * You can use the following pseudo-tables for sorting:
   * [ person, author, group, lang, category, tag, series ]
   * @param what Search criteria
   * @param {ListOptions} options Sorting and pagination options
   * @returns {Promise<ExistingResource[]>} List of resources matching the request.
   */
  async findResourcesByCriteria(what?: Criterion|string|null, options?: ListOptions): Promise<ExistingResource[]> {
    if (typeof what === 'string') {
      what = new CriterionOr(new CriterionEqual('title', what), new CriterionEqual('titleSort', what));
    }

    let crit = this._evalCriterion(what, ResourceSpec);
    let bound = crit.bound;

    let sortList: {
      propName: string;
      propExtra: string;
      sortMode: SortMode;
      rawProp: string;
    }[];

    if (options && options.sortProps) {
      sortList = options.sortProps.map(prop => {
        let [propName, propExtra] = LibraryDatabase._normalizeSortProp(prop.propName);
        return {
          propName: propName,
          propExtra: propExtra,
          rawProp: prop.propName,
          sortMode: prop.sortMode == null ? SortMode.Asc : prop.sortMode
        };
      });
    } else {
      sortList = [];
    }

    // check if there are any duplicated sort properties, in this case we should throw
    for (let j = 1; j < sortList.length; j++) {
      let jItem = sortList[j];
      for (let k = 0; k < j; ++k) {
        if (jItem.propName === sortList[k].propName && jItem.propExtra === sortList[k].propExtra) {
          throw new Error(`Invalid sort option: cannot sort by same property (${jItem.rawProp}) twice`);
        }
      }
    }

    let joins: string[] = [],
        order: string[] = [];

    for (let sortProp of sortList) {
      const makeGroupSortJoin = (where?: WhereClauseBuilder): void => {
        let columns = this._makeForeignSortJoinColumns(sortProp.propExtra, sortProp.sortMode, this._groupSpec, GroupRelationSpec);
        let joinName = uniqueName();
        let computedWhere = where ? where.clause : '';
        joins.push(`LEFT JOIN (SELECT ${columns} FROM res_to_groups_view ${computedWhere} GROUP BY res_id) ${joinName} ON resources.uuid = ${joinName}.res_id`);
        order.push(LibraryDatabase._makeSort(joinName, sortProp.propExtra, sortProp.sortMode, this._groupSpec, GroupRelationSpec));
        if (where) {
          Object.assign(bound, where.bound);
        }
      };

      const makePersonSortJoin = (where?: WhereClauseBuilder): void => {
        let columns = this._makeForeignSortJoinColumns(sortProp.propExtra, sortProp.sortMode, PersonSpec, PersonRelationSpec);
        let joinName = uniqueName();
        let computedWhere = where ? where.clause : '';
        joins.push(`LEFT JOIN (SELECT ${columns} FROM res_to_persons_view ${computedWhere} GROUP BY res_id) ${joinName} ON resources.uuid = ${joinName}.res_id`);
        order.push(LibraryDatabase._makeSort(joinName, sortProp.propExtra, sortProp.sortMode, PersonSpec, PersonRelationSpec));
        if (where) {
          Object.assign(bound, where.bound);
        }
      };

      switch (sortProp.propName) {
        case 'authors': {
          let joinWhere = new WhereClauseBuilder();
          joinWhere.add('relation', PersonRelationSpec.prop('relation').toDb(PersonRelation.Author));
          makePersonSortJoin(joinWhere);
        } break;

        case 'persons': {
          makePersonSortJoin();
        } break;

        case 'groups': {
          makeGroupSortJoin();
        } break;

        default: {
          if (sortProp.propExtra) {
            let groupTypeField = this._groupSpec.prop('groupType');

            let groupType = this.getGroupTypeByName(sortProp.propName);
            if (!groupType) {
              throw new Error(`Invalid sort option: no idea what "${sortProp.propName} is`);
            }

            let joinWhere = new WhereClauseBuilder();
            joinWhere.add(groupTypeField.column, groupTypeField.toDb(groupType));
            makeGroupSortJoin(joinWhere);
          } else {
            order.push(LibraryDatabase._makeSort(null, sortProp.propName, sortProp.sortMode, ResourceSpec));
          }
        }
      }
    }

    // if we have no sorting options, we should sort by resource name by default.
    // also, we need to add sorting by title to the end of sorting options, for resources
    // with equal author names (or whatever we sort by) to be sorted in some way.
    if (!order.length || !sortList.some(sortProp => sortProp.rawProp === 'titleSort')) {
      let mode = options && options.prefSortMode === SortMode.Desc ? SortMode.Desc : SortMode.Asc;
      order.push(LibraryDatabase._makeSort(null, 'titleSort', mode, ResourceSpec));
    }

    // add joins if we need them
    if (crit.personsJoin) {
      joins.push(`INNER JOIN res_to_persons_view persons ON resources.uuid = persons.res_id`);
    }
    if (crit.groupsJoin) {
      joins.push(`INNER JOIN res_to_groups_view groups ON resources.uuid = groups.res_id`);
    }

    let orderClause = 'ORDER BY ' + order.join(', ');

    let limits = LibraryDatabase._limits('', options);

    let whereClause = crit.sql ? 'WHERE ' + crit.sql : '';

    let query: string;
    if (joins && joins.length > 0) {
      query = `SELECT resources.* FROM resources ${joins.join(' ')} ${whereClause} ${orderClause} ${limits}`;
    } else {
      query = `SELECT * FROM resources ${whereClause} ${orderClause} ${limits}`;
    }

    return (await this.db.all(query, bound)).map(row => ResourceSpec.rowToEntry(row));
  }

  /**
   * Get a person with given UUID.
   * @param {string} uuid UUID of the person to find.
   * @returns {Promise<ExistingPerson|null>} Person object for the type or null of person has not been found.
   */
  getPerson(uuid: string): Promise<ExistingPerson|null> {
    return this._getEntry<ExistingPerson>(uuid, PersonSpec);
  }

  /**
   * Add a new person. If UUID is specified on pers argument, registered person will have the specified UUID,
   * otherwise new one will be generated.
   * @param {NewPerson} pers Person object containing properties of the new person.
   * @returns {Promise<ExistingPerson>} Person object that has been added.
   */
  addPerson(pers: NewPerson): Promise<ExistingPerson> {
    return this._addEntry<NewPerson, ExistingPerson>(pers, PersonSpec);
  }

  /**
   * Change an existing person.
   * @param {UpdatePerson} pers Person object with new properties for this person. This object must have UUID specified,
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
  removePerson(person: UpdatePerson|string): Promise<void> {
    return this._removeEntry(Database.getId(person), PersonSpec);
  }

  /**
   * Get list of persons matching specified criteria.
   * All arguments act like it would linked with AND logical operator.
   * For example, if you specify both name and relations, only persons with given name AND relation are going to be returned.
   * Use the function without arguments to get list of all persons registered in the database.
   * @param {string} name Persons with name or nameSort equal to the given value are going to be included in result set.
   * If omitted, name is not important.
   * @param {PersonRelation} relation Get persons that are related to at least one resource with given relation.
   * If omitted, relations are not taken into account.
   * @param {ListOptions} options Sorting and pagination options
   * @returns {Promise<ExistingPerson[]>}
   */
  async findPersons(name?: string, relation?: PersonRelation, options?: ListOptions): Promise<ExistingPerson[]> {
    let nameCrit = name == null ? undefined : new CriterionOr(
        new CriterionEqual('name', name),
        new CriterionEqual('nameSort', name)
    );

    let relationCrit = relation == null ? null : new CriterionHasRelationWith(
        new CriterionEqual('relation', relation)
    );

    let crit: Criterion|undefined;
    if (nameCrit == null && relationCrit == null) {
      crit = undefined;
    } else if (nameCrit != null && relationCrit != null) {
      crit = new CriterionAnd(nameCrit, relationCrit);
    } else {
      crit = nameCrit ? nameCrit : relationCrit as Criterion;
    }

    return this.findPersonsByCriteria(crit, options);
  }

  /**
   * Get list of persons matching specified criteria.
   * Use the function without arguments to get list of all persons registered in the database.
   * @param what Search criteria.
   * @param {ListOptions} options Sorting and pagination options
   * @returns {Promise<ExistingPerson[]>}
   */
  async findPersonsByCriteria(what?: Criterion|null, options?: ListOptions): Promise<ExistingPerson[]> {
    let crit = this._evalCriterion(what, PersonSpec, PersonRelationSpec);
    let computedWhere = crit.sql ? 'WHERE ' + crit.sql : '';
    let limits = LibraryDatabase._limits('nameSort', options, PersonSpec);

    return (await this.db.all(`SELECT * FROM persons ${computedWhere} ${limits}`, crit.bound)).map(row => PersonSpec.rowToEntry(row));
  }

  /**
   * Shorthand for searching persons with given relation.
   * @param {string} name Name of persons to search.
   * @returns {Promise<ExistingPerson[]>}
   */
  findAuthors(name?: string): Promise<ExistingPerson[]> {
    return this.findPersons(name, PersonRelation.Author);
  }

  /**
   * Shorthand for searching persons with given name.
   * Only the first matched person will be returned.
   * It is undefined which object is going to be returned if there are two or more persons with same name.
   * @param {string} name Name of person to search.
   * @returns {Promise<ExistingPerson|null>}
   */
  async findPerson(name: string): Promise<ExistingPerson|null> {
    let persons = await this.findPersons(name);
    return persons.length > 0 ? persons[0] : null;
  }

  /**
   * Get a group with given UUID.
   * @param {string} uuid UUID of the group to find.
   * @returns {Promise<ExistingGroup|null>} Group object for the type or null of group has not been found.
   */
  getGroup(uuid: string): Promise<ExistingGroup|null> {
    return this._getEntry(uuid, this._groupSpec);
  }

  /**
   * Add a new group. If UUID is specified on group argument, registered group will have the specified UUID,
   * otherwise new one will be generated.
   * @param {NewGroup} group Group object containing properties of the new group.
   * @returns {Promise<ExistingGroup>} Group object that has been added.
   */
  async addGroup(group: NewGroup): Promise<ExistingGroup> {
    return await this._addEntry<NewGroup, ExistingGroup>(group, this._groupSpec);
  }

  /**
   * Shorthand for adding a tag with given text.
   * @param {string} text Tag text
   * @param {string} textSort Tag sort text
   * @returns {Promise<ExistingGroup>} Group object
   */
  async addTag(text: string, textSort?: string): Promise<ExistingGroup> {
    return this.addGroup({
      title: text,
      titleSort: textSort ? textSort : text,
      groupType: KnownGroupTypes.Tag
    });
  }

  /**
   * Shorthand for adding a category with given text.
   * @param {string} text Category text
   * @param {string} textSort Category sort text
   * @returns {Promise<ExistingGroup>} Group object
   */
  async addCategory(text: string, textSort?: string): Promise<ExistingGroup> {
    return this.addGroup({
      title: text,
      titleSort: textSort ? textSort : text,
      groupType: KnownGroupTypes.Category
    });
  }

  /**
   * Shorthand for adding a language with given text.
   * @param {string} code Lang code (should be ISO-639 code)
   * @returns {Promise<ExistingGroup>} Group object
   */
  async addLang(code: string): Promise<ExistingGroup> {
    return this.addGroup({
      title: code.toLowerCase(),
      titleSort: code.toLowerCase(),
      groupType: KnownGroupTypes.Language
    });
  }

  /**
   * Shorthand for adding a series with given title.
   * @param {string} title Series title
   * @param {string} titleSort Series sort title
   * @returns {Promise<ExistingGroup>} Group object
   */
  async addSeries(title: string, titleSort?: string): Promise<ExistingGroup> {
    return this.addGroup({
      title: title,
      titleSort: titleSort ? titleSort : title,
      groupType: KnownGroupTypes.Series
    });
  }

  /**
   * Creates a tag with given text if no tag exist, or returns already existing tag with given text.
   * @param {string} text Tag text
   * @returns {Promise<ExistingGroup>} Group object
   */
  async tag(text: string): Promise<ExistingGroup> {
    return await this.findGroup(text, KnownGroupTypes.Tag) || await this.addTag(text);
  }

  /**
   * Creates a language with given text if no lang exist, or returns already existing lang with given text.
   * @param {string} code Language code (should be ISO-639 code)
   * @returns {Promise<ExistingGroup>} Group object
   */
  async lang(code: string): Promise<ExistingGroup> {
    return await this.findGroup(code.toLowerCase(), KnownGroupTypes.Language) || await this.addLang(code);
  }

  /**
   * Creates a category with given text if no category exist, or returns already existing category with given text.
   * @param {string} text Category text
   * @returns {Promise<ExistingGroup>} Group object
   */
  async category(text: string): Promise<ExistingGroup> {
    return await this.findGroup(text, KnownGroupTypes.Category) || await this.addCategory(text);
  }

  /**
   * Creates a series with given text if no series exist, or returns already existing series with given text.
   * @param {string} text Series text
   * @returns {Promise<ExistingGroup>} Group object
   */
  async series(text: string): Promise<ExistingGroup> {
    return await this.findGroup(text, KnownGroupTypes.Series) || await this.addSeries(text);
  }

  /**
   * Returns list of groups matching given criteria.
   * All arguments act like it would linked with AND logical operator.
   * Use the function without arguments to get list of all groups registered in the database.
   * @param {string} text Groups with title or titleSort equal to this value are going to be included in result set.
   * @param {UpdateGroupType | string} groupType Groups with given group type are going to be included in result set.
   * @param {ListOptions} options Sorting and pagination options.
   * @returns {Promise<ExistingGroup[]>} List of groups matching the request.
   */
  async findGroups(text?: string, groupType?: UpdateGroupType|string, options?: ListOptions): Promise<ExistingGroup[]> {
    let textCrit = text == null ? null : new CriterionOr(
        new CriterionEqual('title', text),
        new CriterionEqual('titleSort', text)
    );

    let groupCrit = groupType == null ? null : new CriterionEqual('groupType', groupType);

    let crit: Criterion|undefined;
    if (textCrit == null && groupCrit == null) {
      crit = undefined;
    } else if (textCrit != null && groupCrit != null) {
      crit = new CriterionAnd(textCrit, groupCrit);
    } else {
      crit = textCrit ? textCrit : groupCrit as Criterion;
    }

    return this.findGroupsByCriteria(crit, options);
  }

  /**
   * Returns list of groups matching given criteria.
   * @param {Criterion} what Search criteria
   * @param {ListOptions} options Sorting and pagination options
   * @returns {Promise<ExistingGroup[]>} List of groups matching the request.
   */
  async findGroupsByCriteria(what?: Criterion|null, options?: ListOptions): Promise<ExistingGroup[]> {
    let crit = this._evalCriterion(what, this._groupSpec, GroupRelationSpec);
    let computedWhere = crit.sql ? 'WHERE ' + crit.sql : crit.sql;
    let limits = LibraryDatabase._limits('titleSort', options, this._groupSpec);

    return (await this.db.all(`SELECT * FROM groups ${computedWhere} ${limits}`, crit.bound)).map(row => this._groupSpec.rowToEntry(row));
  }

  /**
   * Shorthand for searching groups.
   * Only the first group is returned.
   * If there are two or more groups with the same name, it is undefined which one is going to be returned by the function.
   * @param {string} text Group text (or sort text)
   * @param {UpdateGroupType | string} groupType group type
   * @returns {Promise<ExistingGroup>}
   */
  async findGroup(text?: string, groupType?: UpdateGroupType|string): Promise<ExistingGroup|null> {
    let groups = await this.findGroups(text, groupType);
    return groups.length > 0 ? groups[0] : null;
  }

  /**
   * Shorthand for searching tags with given text.
   * @param {string} text Tag text or sort text.
   * @returns {Promise<ExistingGroup[]>} List of found tags
   */
  findTags(text?: string): Promise<ExistingGroup[]> {
    return this.findGroups(text, KnownGroupTypes.Tag);
  }

  /**
   * Shorthand for searching categories with given text.
   * @param {string} text Category text or sort text
   * @returns {Promise<ExistingGroup[]>} List of found categories.
   */
  findCategories(text?: string): Promise<ExistingGroup[]> {
    return this.findGroups(text, KnownGroupTypes.Category);
  }

  /**
   * Shorthand for searching series with given text
   * @param {string} text Series text or sort text
   * @returns {Promise<ExistingGroup[]>} List of found series.
   */
  findSeries(text?: string): Promise<ExistingGroup[]> {
    return this.findGroups(text, KnownGroupTypes.Series);
  }

  /**
   * Shorthand for searching languages with given text.
   * @param {string} code Language code
   * @returns {Promise<ExistingGroup[]>} List of found languages.
   */
  findLangs(code?: string): Promise<ExistingGroup[]> {
    return this.findGroups(code ? code.toLowerCase() : code, KnownGroupTypes.Language);
  }

  /**
   * Change an existing group.
   * @param {UpdateGroup} group Group object with new properties for this group. This object must have UUID specified,
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
  removeGroup(group: UpdateGroup|string): Promise<void> {
    return this._removeEntry(Database.getId(group), this._groupSpec);
  }

  /**
   * Create a relation between a resource and person.
   * @param {string} resource UUID of a resource
   * @param {string} person UUID of a person
   * @param {PersonRelation} relation Type of relation to create
   * @returns {Promise<void>}
   */
  async addPersonRelation(resource: UpdateResource|string, person: UpdatePerson|string, relation: PersonRelation): Promise<void> {
    resource = Database.validateId(Database.getId(resource));
    person = Database.validateId(Database.getId(person));

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
  async removePersonRelations(resource: UpdateResource|string, person?: UpdatePerson|string, relation?: PersonRelation): Promise<void> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));

    if (person != null) {
      whereClause.add('person_id', Database.getId(person));
    }

    if (relation != null) {
      whereClause.add('relation', PersonRelationSpec.prop('relation').toDb(relation));
    }

    await this.db.run(`DELETE FROM res_to_persons ${whereClause.clause}`, whereClause.bound);
  }

  /**
   * Get a list of persons this resource relates to.
   * @param {string} resource UUID of a resource
   * @param {PersonRelation} relation Type of relations you are interested in. If not specified, all relations
   * will be returned.
   * @param options Sorting and pagination options
   * @returns {Promise<RelatedPerson[]>} List of relations between persons and this resource.
   */
  async relatedPersons(resource: UpdateResource|string, relation?: PersonRelation|Criterion|null, options?: ListOptions):
            Promise<RelatedPerson[]> {
    resource = Database.getId(resource);

    let crit: Criterion|null = null;
    if (typeof relation === 'number') {
      crit = new CriterionEqual('relation', relation);
    } else if (relation != null) {
      crit = relation;
    }

    let critEval = this._evalCriterion(crit, PersonRelationViewSpec);
    let computedWhere = critEval.sql ? 'AND (' + critEval.sql + ')' : '';
    let limits = LibraryDatabase._limits('nameSort', options, PersonRelationViewSpec);

    let rows: any[] = await this.db.all(`SELECT * FROM res_to_persons_view WHERE res_id = :resource ${computedWhere} ${limits}`,
        Object.assign({
          [':resource']: resource
        }, critEval.bound)
    );

    return rows.map(row => PersonRelationViewSpec.rowToEntry<RelatedPerson>(row));
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
  async addGroupRelation(resource: UpdateResource|string, groupUuid: UpdateGroup|string,
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
        throw new Error(`Cannot add relation with group (UUID = ${groupUuid}) because group type is exclusive and ` +
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

  /**
   * Shorthand for creating a relation between a resource and a tag group.
   * If no tag with given text exist, new one is going to be created.
   * @param {UpdateResource | string} resource A resource to add the tag to
   * @param {string} tagText Tag text
   * @returns {Promise<RelatedGroup>} New group relation.
   */
  async addTagToResource(resource: UpdateResource|string, tagText: string): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.tag(tagText));
  }

  /**
   * Shorthand for creating a relation between a resource and a lang group.
   * If no lang with given code exist, new one is going to be created.
   * @param {UpdateResource | string} resource A resource to add the lang to
   * @param {string} langCode Language code
   * @param {boolean} original If the language is the language the book was written in, set this value to true.
   * Otherwise, specify false.
   * This information is stored in relationTag property.
   * @returns {Promise<RelatedGroup>}
   */
  async addLangToResource(resource: UpdateResource|string, langCode: string, original?: boolean): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.lang(langCode), undefined, original);
  }

  /**
   * Shorthand for creating a relation between a resource and a series.
   * If no series with given text exist, new one is going to be created.
   * @param {UpdateResource | string} resource A resource to add a series to.
   * @param {string} seriesName Series text
   * @param {number} seriesIndex Index of the book inside the series.
   * @param {string} comment You can leave a comment for the relation.
   * This information is stored in relationTag property.
   * @returns {Promise<RelatedGroup>}
   */
  async addSeriesToResource(resource: UpdateResource|string, seriesName: string,
                            seriesIndex: number, comment?: string): Promise<RelatedGroup> {
    return this.addGroupRelation(resource, await this.series(seriesName), seriesIndex, comment);
  }

  /**
   * Removes existing relation (or relations) between a resource and a group. If no relations exist, the function
   * will do nothing. Call it with the only first argument to remove all group relations for a resource.
   * @param {string} resource UUID of a resource
   * @param {string} group UUID of a group. If specified, only relations between the resource and this group are going
   * to be removed (taking {@link groupType} into account, of course).
   * @param {UpdateGroup} groupType If specified, only relations between the resource and groups with given type are
   * going to be removed.
   * @param relationTag If specified, relations between the resource and groups with given relation tag are going to be removed.
   * @returns {Promise<void>}
   */
  async removeGroupRelations(resource: UpdateResource|string, group?: UpdateGroup|string,
                             groupType?: UpdateGroupType|string, relationTag?: any): Promise<void> {
    let whereClause = new WhereClauseBuilder();

    whereClause.add('res_id', Database.getId(resource));
    if (group != null) {
      whereClause.add('group_id', Database.getId(group));
    }

    if (relationTag != null) {
      whereClause.add('relation_tag', relationTag);
    }

    if (typeof groupType === 'string') {
      let fGroupType = this.getGroupType(groupType);
      if (!fGroupType) {
        throw new Error(`Cannot remove group relations: group type with UUID = ${groupType} does not exist`);
      }
      groupType = fGroupType;
    }

    if (groupType != null) {
      let binding = uniqueBoundName();
      whereClause.addRaw(`group_id IN (SELECT uuid FROM groups WHERE type = ${binding})`, {
        [binding]: groupType.uuid
      });
    }

    await this.db.run(`DELETE FROM res_to_groups ${whereClause.clause}`, whereClause.bound);
  }

  /**
   * Get a list of groups a resource relates to.
   * @param {string} resource UUID of a resource
   * @param {UpdateGroupType} groupType If specified, only relations with groups of the specified type will be returned.
   * If not specified, all relations regardless of type will be returned.
   * @param options Sorting and pagination options.
   * @returns {Promise<RelatedGroup[]>}
   */
  async relatedGroups(resource: UpdateResource|string, groupType?: UpdateGroupType|string|Criterion|null,
                      options?: ListOptions): Promise<RelatedGroup[]> {
    let crit: Criterion|null = null;
    if (typeof groupType === 'string') {
      let fetchedGroupType = this.getGroupType(groupType);
      if (!fetchedGroupType) {
        throw new Error(`No group type with UUID [${groupType}] exist`);
      }
      crit = new CriterionEqual('groupType', fetchedGroupType);
    } else if (groupType instanceof Criterion) {
      crit = groupType;
    } else if (groupType != null) {
      crit = new CriterionEqual('groupType', groupType);
    }

    let critEval = this._evalCriterion(crit, this._groupRelationViewSpec);
    let computedWhere = critEval.sql ? 'AND (' + critEval.sql + ')' : '';
    let limits = LibraryDatabase._limits('titleSort', options, this._groupRelationViewSpec);

    let rows: any[] = await this.db.all(`SELECT * FROM res_to_groups_view WHERE res_id = :resource ${computedWhere} ${limits}`,
        Object.assign({
          [':resource']: resource
        }, critEval.bound)
    );

    let results: RelatedGroup[] = [];
    for (let row of rows) {
      results.push(this._groupRelationViewSpec.rowToEntry<RelatedGroup>(row));
    }

    return results;
  }

  /**
   * Get list of object a resource relates to.
   * @param {UpdateResource | string} resource UUID of a resource
   * @param {ObjectRole} role If specified, only relations with specified role will be returned.
   * @param {ListOptions} options Sorting and pagination options.
   * @returns {Promise<ExistingRelatedObject[]>}
   */
  async relatedObjects(resource: UpdateResource|string, role?: ObjectRole|Criterion|null, options?: ListOptions): Promise<ExistingRelatedObject[]> {
    resource = Database.getId(resource);

    let crit: Criterion|null = null;
    if (typeof role === 'number') {
      crit = new CriterionEqual('role', role);
    } else if (role instanceof Criterion) {
      crit = role;
    }

    let critEval = this._evalCriterion(crit, ObjectSpec);
    let computedWhere = critEval.sql ? 'AND (' + critEval.sql + ')' : '';
    let limits = LibraryDatabase._limits(['tag', 'uuid'], options, ObjectSpec);

    let rows: any[] = await this.db.all(`SELECT * FROM objects WHERE res_id = :resource ${computedWhere} ${limits}`,
        Object.assign({
          [':resource']: resource
        }, critEval.bound)
    );

    return rows.map(row => ObjectSpec.rowToEntry<ExistingRelatedObject>(row));
  }

  /**
   * Adds an object relation to a resource.
   * @param {UpdateResource | string} resource A resource to add relation to.
   * @param {NewRelatedObject} obj An object to relate to.
   * @returns {Promise<ExistingRelatedObject>} Created related object.
   */
  async addObjectRelation(resource: UpdateResource|string, obj: NewRelatedObject): Promise<ExistingRelatedObject> {
    resource = Database.getId(resource);
    let objectUuid = Database.validateId(obj.uuid);

    let result = await this.db.run(`INSERT INTO objects(uuid, res_id, role, tag) VALUES(?, ?, ?, ?)`,
        [ objectUuid, resource, ObjectSpec.prop('role').toDb(obj.role),
          ObjectSpec.prop('tag').toDb(obj.tag) ]);

    // return (await this.relatedObjects(resource, new CriterionEqual('rowId', result.lastID)))[0];

    return { ...obj, rowId: result.lastID, resourceUuid: resource };
  }

  /**
   * Updates object relation.
   * @param {UpdateRelatedObject} obj RelatedObject to be update
   * @returns {Promise<void>}
   */
  async updateObjectRelation(obj: UpdateRelatedObject): Promise<void> {
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

    let whereClause = new WhereClauseBuilder();
    whereClause.add('id', obj.rowId);

    let result = await this.db.run(`UPDATE objects ${setClause.clause} ${whereClause.clause}`,
        Object.assign({}, setClause.bound, whereClause.bound));
    if (result.changes === 0) {
      throw new Error('Cannot update object relation: no record with given rowId exists');
    }
  }

  /**
   * Removes a relation between a resource and an object
   * @param {UpdateRelatedObject} obj Related object to remove.
   * @returns {Promise<void>}
   */
  async removeObjectRelation(obj: UpdateRelatedObject): Promise<void> {
    if (obj.rowId == null) {
      throw new Error('Cannot remove object relation: rowId is invalid');
    }

    let result = await this.db.run(`DELETE FROM objects WHERE id = ?`, [ obj.rowId ]);
    if (result.changes === 0) {
      throw new Error('Cannot remove object relation: no record with given rowId exists');
    }
  }

  async findObjectsByCriteria(what?: Criterion|null, options?: ListOptions): Promise<ExistingRelatedObject[]> {
    let crit = this._evalCriterion(what, ObjectSpec);
    let computedWhere = crit.sql ? 'WHERE ' + crit.sql : '';
    let limits = LibraryDatabase._limits(['tag', 'uuid'], options, ObjectSpec);

    return (await this.db.all(`SELECT * FROM objects ${computedWhere} ${limits}`, crit.bound)).map(row => ObjectSpec.rowToEntry(row));
  }

  async getObjectsTags(options?: ListOptions): Promise<string[]> {
    let limits = LibraryDatabase._limits('tag', options, ObjectSpec);
    return (await this._db.all(`SELECT DISTINCT tag FROM objects ${limits}`)).map(row => row.tag);
  }

  /** Protected area **/

  protected _groupTypes: ExistingGroupType[] = [];

  protected _groupSpec = new EntrySpec('groups', 'group', [
      new UuidFieldSpec(),
      new GenericFieldSpec('title', 'title', PropValidators.String, PropValidators.String),
      new GenericFieldSpec('titleSort', 'title_sort', PropValidators.String, PropValidators.String),
      new GroupTypeFieldSpec('groupType', 'type', this)
  ]);

  protected _groupRelationViewSpec = new EntrySpec('res_to_groups_view', 'related_group', [
      new UuidFieldSpec('uuid', 'linked_id'),
      new GenericFieldSpec('title', 'title', PropValidators.String, PropValidators.String),
      new GenericFieldSpec('titleSort', 'title_sort', PropValidators.String, PropValidators.String),
      new GroupTypeFieldSpec('groupType', 'type', this),
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
    uuid = Database.validateId(uuid);

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
    let entryUuid = Database.validateId(entry.uuid);

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
      throw new Error(`Cannot update ${spec.objectType}: no entry with given UUID have been found`);
    }
  }

  protected async _addEntry<T extends { uuid?: string|null } & { [name: string]: any }, Y>(entry: T, spec: EntrySpec): Promise<Y> {
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

    return workaroundSpread(entry, entryUuid, spec.objectType);
  }

  protected async _removeEntry<T>(uuid: string, spec: EntrySpec): Promise<void> {
    uuid = Database.validateId(uuid);
    await this.db.run(`DELETE FROM ${spec.table} WHERE uuid = ?`, [ uuid ]);
  }

  protected _makeForeignSortJoinColumns(sortProp: string, sortMode: SortMode, tableSpec: EntrySpec,
                                        tableLinksSpec: EntrySpec): string {
    let columns: string[] = [];
    columns.push('res_id');

    if (tableSpec.propSupported(sortProp)) {
      columns.push(fieldMapper(tableSpec.prop(sortProp)));
    } else if (tableLinksSpec.propSupported(sortProp)) {
      columns.push(fieldMapper(tableLinksSpec.prop(sortProp)));
    } else {
      throw new Error(`Invalid sort option: cannot find column matching a property named ${sortProp}`);
    }

    function fieldMapper(field: FieldSpec): string {
      if (field.prop === sortProp) {
        let sortFunc = sortMode === SortMode.Desc ? 'max' : 'min';
        return `${sortFunc}(${field.column}) as ${field.column}`;
      } else if (field.prop === 'uuid') {
        return '';
      } else {
        return field.column;
      }
    }

    return columns.join(', ');
  }

  protected static _makeSort(table: string|null, sortProp: string, mode: SortMode|undefined, ...specs: EntrySpec[]): string {
    let columnName: string|null = null;
    for (let spec of specs) {
      if (spec.propSupported(sortProp)) {
        columnName = spec.prop(sortProp).column;
        break;
      }
    }
    if (columnName == null) {
      throw new Error(`Cannot find a column to match a sorting property ${sortProp}`);
    }

    let sortMode = mode === SortMode.Desc ? 'DESC' : 'ASC';

    let tablePrefix = table ? table + '.' : '';
    return `${tablePrefix}${columnName} COLLATE NOCASE ${sortMode}`;
  }

  protected static _limits(prefSortProp: string|string[], options?: ListOptions, ...specs: EntrySpec[]): string {
    let resultParts: string[] = [];

    if (specs.length > 0) {
      let sortParts: string[] = [];
      if (options && options.sortProps && options.sortProps.length > 0) {
        for (let sortProp of options.sortProps) {
          if (sortProp.propName) {
            sortParts.push(this._makeSort(null, sortProp.propName, sortProp.sortMode, ...specs))
          }
        }
      }

      if (!sortParts.length || !options || !options.sortProps ||
          !options.sortProps.some(sortProp => sortProp.propName === prefSortProp)) {
        let mode = options && options.prefSortMode === SortMode.Desc ? SortMode.Desc : SortMode.Asc;
        if (Array.isArray(prefSortProp)) {
          for (let prop of prefSortProp) {
            sortParts.push(this._makeSort(null, prop, mode, ...specs));
          }
        } else {
          sortParts.push(this._makeSort(null, prefSortProp, mode, ...specs));
        }
      }

      resultParts.push('ORDER BY ' + sortParts.join(', '));
    }

    if (options && options.maxCount != null && typeof options.maxCount === 'number'
        && options.maxCount >= 0) {
      resultParts.push('LIMIT ' + Math.round(options.maxCount));
    }
    if (options && options.offset != null && typeof options.offset === 'number'
        && options.offset >= 0) {
      resultParts.push('OFFSET ' + Math.round(options.offset));
    }

    return resultParts.join(' ');
  }

  protected static _normalizeSortProp(prop: string): string[] {
    let [propName, propExtra] = this._splitProp(prop);

    if (!propExtra) {
      switch (propName.toLowerCase().trim()) {
        case 'author':
        case 'authors':
          return ['authors', 'nameSort'];

        case 'person':
        case 'persons':
          return ['persons', 'nameSort'];

        case 'group':
        case 'groups':
          return ['groups', 'titleSort'];

        case 'tag':
        case 'tags':
          return ['tags', 'titleSort'];

        case 'category':
        case 'categories':
          return ['categories', 'titleSort'];

        case 'lang':
        case 'langs':
          return ['langs', 'titleSort'];

        case 'series':
          return ['series', 'titleSort'];
      }
    }
    return [propName, propExtra];
  }

  protected static _splitProp(prop: string): string[] {
    let hashIndex = prop.indexOf('#');

    let propName: string, propExtra: string;

    if (hashIndex >= 0) {
      propName = prop.slice(0, hashIndex);
      propExtra = prop.slice(hashIndex + 1);

      if (!propExtra) {
        throw new Error(`Invalid property name: ${prop}`);
      }
    } else {
      propName = prop;
      propExtra = '';
    }

    return [propName, propExtra];
  }

  protected static _normalizeCriterionProp(prop: string): string[] {
    let [propName, propExtra] = this._splitProp(prop);

    switch (propName.toLowerCase().trim()) {
      case 'author':
      case 'authors':
        propName = 'authors';
        break;

      case 'person':
      case 'persons':
        propName = 'persons';
        break;

      case 'group':
      case 'groups':
        propName = 'groups';
        break;

      case 'tag':
      case 'tags':
        propName = 'tags';
        break;

      case 'category':
      case 'categories':
        propName = 'categories';
        break;

      case 'lang':
      case 'langs':
        propName = 'langs';
        break;

      case 'series':
        propName = 'series';
        break;
    }

    return [propName, propExtra];
  };

  protected _evalCriterion(crit: Criterion|null|undefined, spec: EntrySpec, linkSpec?: EntrySpec|null,
                           inContext?: EvalCriterionContext): EvalCriterionResult {
    let result: EvalCriterionResult = {
      sql: '',
      bound: {},
      personsJoin: false,
      groupsJoin: false
    };

    if (crit == null) {
      return result;
    }

    crit = this._normalizeCriterion(crit, spec);

    let context: EvalCriterionContext = inContext ? inContext : { };

    const computeArg = (arg: any, crit: Criterion, argIndex: number): string => {
      if (arg instanceof CriterionProp) {
        let prop = arg.prop;
        if (spec.propSupported(prop)) {
          return (context.field = spec.prop(prop)).column;
        } else if (spec === ResourceSpec) {
          let [propName, propExtra] = LibraryDatabase._splitProp(prop);

          switch (propName) {
            case 'persons': {
              result.personsJoin = true;
              if (PersonRelationViewSpec.propSupported(propExtra)) {
                return 'persons.' + (context.field = PersonRelationViewSpec.prop(propExtra)).column;
              } else {
                throw new Error(`Invalid search criterion: ${prop}`);
              }
            }

            case 'groups': {
              result.groupsJoin = true;
              if (this._groupRelationViewSpec.propSupported(propExtra)) {
                return 'groups.' + (context.field = this._groupRelationViewSpec.prop(propExtra)).column;
              } else {
                throw new Error(`Invalid search criterion: ${prop}`);
              }
            }

            default:
              throw new Error(`Invalid search criterion: no idea what ${prop} is`);
          }
        } else {
          throw new Error(`Invalid search criterion: no property named ${prop} has been found`);
        }
      } else if (arg instanceof Criterion) {
        let subResult = this._evalCriterion(arg, spec, linkSpec, { });
        Object.assign(result.bound, subResult.bound);
        result.personsJoin = result.personsJoin || subResult.personsJoin;
        result.groupsJoin = result.groupsJoin || subResult.groupsJoin;
        return subResult.sql;
      } else {
        if (context.field == null) {
          throw new Error('Invalid search criterion: cannot convert a value to a database-suitable form');
        }
        let bindingName = uniqueBoundName();
        result.bound[bindingName] = context.field.toDb(arg);
        return bindingName;
      }
    };

    switch (crit.op) {
      case Operator.Equal: {
        let left = computeArg(crit.args[0], crit, 0);
        let right = computeArg(crit.args[1], crit, 1);

        result.sql = `${left} = ${right}`;
      } break;

      case Operator.And: {
        result.sql = crit.args.map((arg, i) => '(' + computeArg(arg, crit as Criterion, i) + ')').join(' AND ');
      } break;

      case Operator.Or: {
        result.sql = crit.args.map((arg, i) => '(' + computeArg(arg, crit as Criterion, i) + ')').join(' OR ');
      } break;

      case Operator.HasRelationWith: {
        if (!linkSpec) {
          throw new Error('Search criterion is invalid: you cannot use HasRelationWith on this query');
        }
        let subResult = this._evalCriterion(crit.args[0] as Criterion, linkSpec);
        Object.assign(result.bound, subResult.bound);
        let viewTable = linkSpec.table + '_view';
        let computedWhere = subResult.sql ? 'WHERE ' + subResult.sql : '';
        result.sql = `uuid IN (SELECT ${viewTable}.linked_id FROM ${viewTable} ${computedWhere})`
      } break;

      default: {
        throw new Error('Search criterion is invalid: unknown operator');
      }
    }

    return result;
  }

  protected _normalizeCriterion(crit: Criterion, spec: EntrySpec): Criterion {
    function buildProp(propName: string, propExtra: string): string {
      return propExtra ? propName + '#' + propExtra : propName;
    }

    if (crit.fixedArgCount === 2) {
      // move property to the first place if it is not the first one
      if (crit.args[1] instanceof CriterionProp && !(crit.args[0] instanceof CriterionProp)) {
        [crit.args[0], crit.args[1]] = [crit.args[1], crit.args[0]];
      }
    }

    if (spec === ResourceSpec) {
      // first replace pseudo-tables like 'authors' or 'tags' with persons and groups
      for (let j = 0; j < crit.args.length; ++j) {
        let arg = crit.args[j];

        if (arg instanceof CriterionProp) {
          let [propName, propExtra] = LibraryDatabase._normalizeCriterionProp(arg.prop);

          if (propName === 'authors') {
            // add AND relation = PersonRelation.Author to the criterion
            arg.prop = buildProp('persons', propExtra);
            let result = new CriterionAnd(crit, new CriterionEqual('persons#relation', PersonRelation.Author));
            return this._normalizeCriterion(result, spec);
          } else {
            let groupType = this.getGroupTypeByName(propName);
            if (groupType) {
              arg.prop = buildProp('groups', propExtra);
              let result = new CriterionAnd(crit, new CriterionEqual('groups#groupType', groupType));
              return this._normalizeCriterion(result, spec);
            }
          }

          arg.prop = buildProp(propName, propExtra);
        } else if (arg instanceof Criterion) {
          crit.args[j] = this._normalizeCriterion(arg, spec);
        }
      }

      // now replace default search (when a table used without a property) with preferred option
      if (crit instanceof CriterionEqual && crit.args[0] instanceof CriterionProp && crit.args[0].prop.indexOf('#') < 0) {
        if (crit.args[0].prop === 'persons') {
          return new CriterionOr(new CriterionEqual('persons#name', crit.args[1]), new CriterionEqual('persons#nameSort', crit.args[1]));
        } else if (crit.args[0].prop === 'groups') {
          return new CriterionOr(new CriterionEqual('groups#name', crit.args[1]), new CriterionEqual('groups#nameSort', crit.args[1]));
        }
      }
    }

    return crit;
  }
}

interface EvalCriterionResult {
  sql: string;
  bound: SqlBindings;
  personsJoin: boolean;
  groupsJoin: boolean;
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
  constructor(protected _table: string, protected _objectType: string, protected _fieldSpecs: FieldSpec[],
              protected _id: string = 'uuid', protected _keys: { [name: string]: string } = {}) { }

  get fieldSpecs(): FieldSpec[] { return this._fieldSpecs; }
  get table(): string { return this._table; }
  get objectType(): string { return this._objectType; }
  get id(): string { return this._id; }

  linkColumn(table: EntrySpec): string|null {
    if (this._keys) {
      for (let key of Object.keys(this._keys)) {
        if (this._keys[key] === table.table) {
          return key;
        }
      }
    }
    return null;
  }

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

  rowToEntry<T extends AbstractDbObject>(row: { [name: string]: any }, completeObject?: { [name: string]: any }): T {
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

    result.type = this.objectType;
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

const ObjectSpec = new EntrySpec('objects', 'related_object', [
    new GenericFieldSpec('rowId', 'id', PropValidators.OneOf(PropValidators.Number, PropValidators.Empty),
        PropValidators.Number),
    new UuidFieldSpec('resourceUuid', 'res_id'),
    new UuidFieldSpec('uuid', 'uuid'),
    new GenericFieldSpec('role', 'role', PropValidators.Number, PropValidators.Number),
    new GenericFieldSpec('tag', 'tag', PropValidators.String, PropValidators.String),
], 'rowId');

const GroupTypeSpec = new EntrySpec('group_types', 'group_type', [
    new UuidFieldSpec(),
    new GenericFieldSpec('name', 'name', PropValidators.String, PropValidators.String),
    new GenericFieldSpec('exclusive', 'exclusive', PropValidators.Boolean, PropValidators.Boolean),
    new GenericFieldSpec('ordered', 'ordered', PropValidators.Boolean, PropValidators.Boolean)
]);

const PersonRelationSpec = new EntrySpec('res_to_persons', 'related_person', [
    new GenericFieldSpec('relation', 'relation', PropValidators.Number, PropValidators.Number)
], undefined, {
  res_id: 'resources',
  person_id: 'persons'
});

const PersonRelationViewSpec = new EntrySpec('res_to_persons_view', 'related_person', [
  new UuidFieldSpec('uuid', 'linked_id'),
  new GenericFieldSpec('relation', 'relation', PropValidators.Number, PropValidators.Number),
  new GenericFieldSpec('name', 'name', PropValidators.String, PropValidators.String),
  new GenericFieldSpec('nameSort', 'name_sort', PropValidators.String, PropValidators.String)
]);

const GroupRelationSpec = new EntrySpec('res_to_groups', 'related_group', [
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
], undefined, {
  res_id: 'resources',
  group_id: 'groups'
});

/**
 * This function only exists because of TypeScript bug preventing from using object spread operator in form
 * of 'return { ...obj, uuid: uuid }
 * https://github.com/Microsoft/TypeScript/issues/13557
 * As soon as the issue will be fixed, this function needs to be removed.
 */
function workaroundSpread(obj: { [name: string]: any }, uuid: string, objectType: string): any {
  let result: { [name: string]: any } = {};
  Object.keys(obj).forEach(prop => {
    result[prop] = obj[prop];
  });
  result.uuid = uuid;
  result.type = objectType;
  return result;
}

type SqlBindings = { [name: string]: any };

abstract class ClauseBuilder {
  abstract get clause(): string;

  add(column: string, value: any): void {
    let bindName = uniqueBoundName();
    this.addRaw(column + ' = ' + bindName, {
      [bindName]: value
    });
  }

  addRaw(cond: string, bindings: SqlBindings): void {
    this._list.push(cond);
    Object.assign(this._bound, bindings);
  }

  get bound(): SqlBindings {
    return this._bound;
  }

  /** Protected area **/

  protected _list: string[] = [];
  protected _bound: SqlBindings = {};
}

export class WhereClauseBuilder extends ClauseBuilder {
  get clause(): string {
    if (this._list.length > 0) {
      return ' WHERE ' + this._list.join(' AND ');
    } else {
      return '';
    }
  }
}

export class SetClauseBuilder extends ClauseBuilder {
  get clause(): string {
    return ' SET ' + this._list.join(', ');
  }
}

function uniqueName(): string {
  return 'uniq_' + Math.floor(Math.random() * 100000);
}

function uniqueBoundName(): string {
  return ':' + uniqueName();
}

interface EvalCriterionContext {
  field?: FieldSpec;
}
