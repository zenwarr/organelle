import * as iassign from 'immutable-assign';

export interface AbstractDbObject {
  type?: string;
}

/**
 * Resources are basic building blocks of a library. Any book or article or a magazine issue you store is a Resource.
 */
export interface Resource extends AbstractDbObject {
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

export interface ExistingResource extends Resource {
  uuid: string;
  title: string;
  titleSort: string;
  rating: number;
  addDate: Date;
  lastModifyDate: Date;
  publishDate: string|Date;
  publisher: string;
  desc: string;
}

export interface FullResourceData extends ExistingResource {
  relatedPersons: RelatedPerson[];
  relatedGroups: RelatedGroup[];
  relatedObjects: ResolvedRelatedObject[];
}

/**
 * Any person that should be mentioned in library (author, translator or editor) is represented by such objects.
 */
export interface Person extends AbstractDbObject {
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

export interface ExistingPerson extends Person {
  uuid: string;
  name: string;
  nameSort: string;
}

export enum PersonRelation {
  Author = 1,
  Editor,
  Translator
}

const RELATION_NAMES: string[] = [ 'author', 'editor', 'translator' ];

/**
 * Converts a member of PersonRelation enum to string representation suitable for transferring values.
 * @param {PersonRelation} relation Relation value
 * @returns {string} String representation
 */
export function personRelationToString(relation: PersonRelation): string {
  --relation;
  if (relation >= 0 && relation < RELATION_NAMES.length) {
    return RELATION_NAMES[relation];
  } else {
    throw new Error();
  }
}

/**
 * Converts string representation of PersonRelation back to enumeration member.
 * @param {string} text String representation of the value
 * @returns {PersonRelation} Enumeration value
 */
export function personRelationFromString(text: string): PersonRelation {
  let index = RELATION_NAMES.indexOf(text.toLowerCase().trim());
  if (index >= 0) {
    return index + 1;
  } else {
    throw new Error();
  }
}

/**
 * An extended version of Person, which mentions a relation this person has to a resource. All supported types
 * of relations are listed in {@link PersonRelation} enumeration.
 */
export interface RelatedPerson extends ExistingPerson {
  relation: PersonRelation;
}

export interface NewRelatedPerson extends NewPerson {
  relation: PersonRelation;
}

/**
 * Books are grouped into... groups. A tag is a group. A category is a group. A series a book belongs to is a group.
 * Groups can have different types that separate different sets of groups one of another.
 * For example, if you want to tag all cool books with a tag named "cool books" you should first create a group
 * with name = "cool books" and group type of KnownGroupTypes.Tags and create a relation between each cool book
 * and this group. You can create you own groups.
 */
export interface Group extends AbstractDbObject {
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
  groupType?: ExistingGroupType|string;
}

export interface NewGroup extends Group {
  uuid?: string|null;
  title: string;
  titleSort: string;
  groupType: ExistingGroupType|string;
}

export interface UpdateGroup extends Group {
  uuid: string;
}

export interface ExistingGroup extends Group {
  uuid: string;
  title: string;
  titleSort: string;
  groupType: ExistingGroupType;
}

/**
 * An extended version of a Group that mentions index a resource has in a group it relates to.
 */
export interface RelatedGroup extends ExistingGroup {
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
export interface GroupType extends AbstractDbObject {
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

export interface ExistingGroupType extends GroupType {
  uuid: string;
  name: string;
  exclusive: boolean;
  ordered: boolean;
}

export enum ObjectRole {
  Format = 1,
  Cover
}

const ROLE_NAMES = [ 'format' ];

/**
 * Converts a member of PersonRelation enum to string representation suitable for transferring values.
 * @param {PersonRelation} relation Relation value
 * @returns {string} String representation
 */
export function objectRoleToString(role: ObjectRole): string {
  --role;
  if (role >= 0 && role < ROLE_NAMES.length) {
    return ROLE_NAMES[role];
  } else {
    throw new Error();
  }
}

/**
 * Converts string representation of PersonRelation back to enumeration member.
 * @param {string} text String representation of the value
 * @returns {PersonRelation} Enumeration value
 */
export function objectRoleFromString(text: string): ObjectRole {
  let index = ROLE_NAMES.indexOf(text.toLowerCase().trim());
  if (index >= 0) {
    return index + 1;
  } else {
    throw new Error();
  }
}

export interface RelatedObject extends AbstractDbObject {
  rowId?: number;
  resourceUuid?: string;
  uuid?: string|null;
  role?: ObjectRole;
  tag?: string;
}

export interface ExistingRelatedObject extends RelatedObject {
  rowId: number;
  resourceUuid: string;
  uuid: string;
  role: ObjectRole;
  tag: string;
}

export interface UpdateRelatedObject extends RelatedObject {
  rowId: number;
}

export interface NewRelatedObject extends RelatedObject {
  uuid: string;
  role: ObjectRole;
  tag: string;
}

export interface ResolvedRelatedObject extends ExistingRelatedObject {
  location: string|null;
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

export function objectFromAPI<T extends AbstractDbObject>(obj: any): T {
  function getDate(input: string): Date {
    let parsedTS = Date.parse(input);
    return new Date(Number.isNaN(parsedTS) ? 0 : parsedTS);
  }

  let aobj = obj as AbstractDbObject;
  switch (aobj.type) {
    case 'resource':
      return iassign(obj, newObj => {
        (newObj as Resource).addDate = getDate(obj.addDate);
        (newObj as Resource).lastModifyDate = getDate(obj.lastModifyDate);
        return newObj;
      }) as T;
  }

  return obj as T;
}
