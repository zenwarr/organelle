export interface DatabaseFactory {
  open(): Promise<Database>;
  create(filename: string): Promise<Database>;
}

export enum QueryTarget {
  Resource,
  Person,
  Series,
  Cover
}

export class QueryFilter {
  // static parse(query: string): QueryFilter;
}

export interface QueryResult {

}

export interface Database {
  // queryResources(filter: QueryFilter): Promise<QueryResult<ResourceEntry>>;
}

export type EntryID = number;
export type EntryUUID = string;

export class ResourceEntry {
  uuid: EntryUUID;
  title: string;
  titleSort: string;
  persons: PersonEntry[];
  seriesData: SeriesDataEntry[];
  rating: number;
  tags: string[];
  addDate: Date;
  lastModifyDate: Date;
  publishDate: string;
  publisher: string;
  langs: string[];
  desc: string;
  cover: CoverEntry;
  objects: ObjectEntry[];
  customFiels: CustomFieldEntry[];
}

export enum PersonRelation {
  Author = 0,
  Editor
}

export class PersonEntry {
  uuid: EntryUUID;
  name: string;
  nameSort: string;
  relation: PersonRelation;
}

export class SeriesDataEntry {
  uuid: EntryUUID;
  title: string;
  index: number;
}

export enum CoverSource {
  Metadata = 0,
  Custom,
  Extracted,
  Generated,
  Fetched
}

export class CoverEntry {
  uuid: EntryUUID;
}

export class ObjectEntry {
  uuid: string;
}

export class CustomFieldEntry {
  name: string;
  value: string;
}

export class StorageEntry {
  uuid: string;
  title: string;
  location: string;
}
