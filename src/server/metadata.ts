import {
  GroupType, KnownGroupTypes, LibraryDatabase, Person, PersonRelation, RelatedPerson,
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

  return function(name: string, specifier: string|null): any|Promise<any> {
    switch (name) {
      case 'title': {
        return resource.title ? resource.title : '';
      }

      case 'title_sort': {
        return resource.titleSort ? resource.titleSort : (resource.title ? resource.title : '');
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
          lib.relatedPersons(resource, PersonRelation.Author).then((persons) => {
            if (persons.length > 0) {
              resolve(persons[0].name);
            }
            resolve(null);
          });
        });
      }

      case 'author_sort': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedPersons(resource, PersonRelation.Author).then((persons) => {
            if (persons.length > 0) {
              resolve(persons[0].nameSort ? persons[0].nameSort : (persons[0].name ? persons[0].name : ''));
            } else {
              resolve('');
            }
          });
        });
      }

      case 'authors': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedPersons(resource, PersonRelation.Author).then((persons) => {
            resolve(persons.map(person => person.name as string));
          });
        });
      }

      case 'authors_sort': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedPersons(resource, PersonRelation.Author).then((persons) => {
            resolve(persons.map(
                person => person.nameSort ? person.nameSort : (person.name ? person.name : '')
            ));
          });
        });
      }

      case 'tags': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Tag).then((groups) => {
            resolve(groups.map(group => group.title as string));
          });
        });
      }

      case 'category': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Category).then((groups) => {
            if (groups.length > 0) {
              resolve(groups[0].title);
            } else {
              resolve('');
            }
          });
        });
      }

      case 'lang': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Language).then((langs) => {
            if (langs.length > 0) {
              resolve(langs[0].title);
            } else {
              resolve('');
            }
          });
        });
      }

      case 'langs': {
        return new Promise<string[]>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Language).then(langs => {
            return langs.map(lang => lang.title);
          });
        });
      }

      case 'series': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Series).then((seriesList) => {
            if (seriesList.length > 0) {
              resolve(seriesList[0].title);
            } else {
              resolve('');
            }
          });
        });
      }

      case 'series_list': {
        return new Promise<string[]>(resolve => {
          lib.relatedGroups(resource, KnownGroupTypes.Series).then(seriesList => {
            resolve(seriesList.map(series => series.title as string));
          });
        });
      }

      case 'series_index': {
        return new Promise<string>((resolve, reject) => {
          lib.relatedGroups(resource, KnownGroupTypes.Series).then((seriesList) => {
            if (seriesList.length > 0) {
              resolve('' + seriesList[0].groupIndex);
            } else {
              resolve('');
            }
          });
        });
      }

      default:
        return null;
    }
  }
}
