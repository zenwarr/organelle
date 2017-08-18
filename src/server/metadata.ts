import {
  GroupType, KnownGroupTypes, LibraryDatabase, Person, PersonRelation, RelatedGroup, RelatedPerson,
  Resource
} from "./library-db";
import {VarResolver} from "./formatter";
import {timestampToDate} from "./common";

export interface ExtractedMetadata {
  title?: string;
  persons?: RelatedPerson[];
  genres?: string[];
  desc?: string;
  tags?: string[];
  langs?: string[];
  coverFilename?: string;
}

export abstract class MetadataParser {
  constructor(protected _filename: string) {

  }

  abstract async extract(): Promise<ExtractedMetadata>;

  static async createResource(lib: LibraryDatabase, md: ExtractedMetadata): Promise<Resource> {
    let sp = await lib.begin();
    try {
      let resource = await lib.addResource({
        title: md.title ? md.title : '',
        titleSort: md.title ? md.title : '',
        desc: md.desc
      });

      if (md.persons) {
        for (let mdPerson of md.persons) {
          if (mdPerson.name) {
            let personObj = await lib.findPerson(mdPerson.name);
            if (!personObj) {
              personObj = await lib.addPerson({
                name: mdPerson.name ? mdPerson.name : '',
                nameSort: mdPerson.name ? mdPerson.name : ''
              });
            }

            await lib.addPersonRelation(resource, personObj, mdPerson.relation);
          }
        }
      }

      if (md.tags) {
        for (let mdTag of md.tags) {
          await lib.addTagToResource(resource, mdTag);
        }
      }

      if (md.langs) {
        for (let mdLang of md.langs) {
          await lib.addLangToResource(resource, mdLang);
        }
      }

      await lib.commit(sp);

      return resource;
    } catch (err) {
      await lib.rollback(sp);
      throw err;
    }
  }

  static async updateResource(lib: LibraryDatabase, resource: Resource|string,
                              md: ExtractedMetadata): Promise<Resource> {
    throw new Error("Method not implemented");
  }

  /** Protected area **/
}

function formatPerson(person: Person, specifier: string|null): string {
  return person.name ? person.name : '';
}

export async function createResourceVarResolver(lib: LibraryDatabase,
                                         res: Resource|string): Promise<VarResolver> {
  let resource: Resource;
  if (typeof res === 'string') {
    let fResource = await lib.getResource(res);
    if (!fResource) {
      throw new Error(`No resource with UUID ${res} exists`);
    } else {
      resource = fResource;
    }
  } else if (!res) {
    throw new Error('Invalid resource');
  } else {
    resource = res;
  }

  function personToValue(pers: RelatedPerson, specifier: string|null): string {
    if (specifier === 'sort') {
      return pers.nameSort ? pers.nameSort : (pers.name ? pers.name : '');
    } else {
      return pers.name ? pers.name : '';
    }
  }

  function groupToValue(group: RelatedGroup, specifier: string|null): string {
    if (specifier === 'sort') {
      return group.titleSort ? group.titleSort : (group.title ? group.title : '');
    } else if (specifier === 'index') {
      return group.groupIndex == null ? '' : '' + group.groupIndex;
    } else if (specifier === 'tag') {
      return group.relationTag == null ? '' : group.relationTag;
    } else {
      return group.title == null ? '' : group.title;
    }
  }

  function groupsToValues(groupList: RelatedGroup[], specifier: string|null): string[] {
    return groupList.map(group => groupToValue(group, specifier));
  }

  function firstGroupToValue(groupList: RelatedGroup[], specifier: string|null): string {
    if (groupList.length > 0) {
      return groupToValue(groupList[0], specifier);
    } else {
      return '';
    }
  }

  return function(name: string, specifier: string|null): any|Promise<any> {
    switch (name) {
      case 'title': {
        if (specifier === 'sort') {
          return resource.titleSort ? resource.titleSort : (resource.title ? resource.title : '');
        } else {
          return resource.title ? resource.title : '';
        }
      }

      case 'rating': {
        return resource.rating == null ? '' : '' + (resource.rating / 100);
      }

      case 'add_date': {
        return resource.addDate ? resource.addDate.toLocaleString() : '';
      }

      case 'mod_date': {
        return resource.lastModifyDate ? resource.lastModifyDate.toLocaleString() : '';
      }

      case 'publish_date': {
        if (typeof resource.publishDate === 'string') {
          return resource.publishDate;
        } else if (resource.publishDate == null) {
          return '';
        } else {
          return resource.publishDate.toLocaleString();
        }
      }

      case 'publisher': {
        return resource.publisher ? resource.publisher : '';
      }

      case 'desc': {
        return resource.desc ? resource.desc : '';
      }

      case 'author': {
        return new Promise<string | null>((resolve, reject) => {
          lib.relatedPersons(resource, PersonRelation.Author).then(persons => {
            if (persons.length > 0) {
              resolve(personToValue(persons[0], specifier));
            }
            resolve(null);
          });
        });
      }

      case 'authors': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedPersons(resource, PersonRelation.Author).then(persons => {
            resolve(persons.map(person => personToValue(person, specifier)));
          });
        });
      }

      case 'tags': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Tag).then(groups => {
            resolve(groupsToValues(groups, specifier));
          });
        });
      }

      case 'category': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Category).then(groups => {
            resolve(firstGroupToValue(groups, specifier));
          });
        });
      }

      case 'lang': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Language).then(langs => {
            resolve(firstGroupToValue(langs, specifier));
          });
        });
      }

      case 'langs': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Language).then(langs => {
            resolve(groupsToValues(langs, specifier));
          });
        });
      }

      case 'series': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Series).then(seriesList => {
            resolve(firstGroupToValue(seriesList, specifier));
          });
        });
      }

      case 'series_list': {
        return new Promise<string[]>(resolve => {
          lib.relatedGroups(resource, KnownGroupTypes.Series).then(seriesList => {
            resolve(groupsToValues(seriesList, specifier));
          });
        });
      }

      default:
        return null;
    }
  }
}
