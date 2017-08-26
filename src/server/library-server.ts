import {Library} from "./library";
import * as restify from 'restify';
import * as restifyErrors from 'restify-errors';
import {Database} from "./db";
import {
  Group, GroupType, ListOptions, Person, PersonRelation, personRelationFromString, personRelationToString,
  RelatedPerson,
  Resource, SortMode
} from "./library-db";
import {strictParseInt} from "../common/helpers";

export const DEF_SERVER_PORT = 8080;

export class LibraryServer {
  constructor(protected _lib: Library) {
    this._server = restify.createServer();
    this._server.use(restify.plugins.queryParser());
    this._initRoutes();
  }

  start(port: number = DEF_SERVER_PORT): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._server.listen(port, resolve);
    });
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._server.once('close', () => {
        resolve();
      });
      this._server.close();
    });
  }

  get server(): restify.Server {
    return this._server;
  }

  /** Protected area **/

  protected _server: restify.Server;

  protected _initRoutes(): void {
    let self = this;

    function wrap(func: (...args: string[]) => Promise<any>) {
      return function(req: restify.Request, resp: restify.Response, next: restify.Next) {
        func.call(self, req.params, req.query).then((apiResponse: any) => {
          resp.json(200, apiResponse);
          next();
        }, (err: Error) => {
          if (err instanceof restifyErrors.HttpError) {
            next(err);
          } else {
            next(new restifyErrors.InternalServerError(err.message));
          }
        });
      }
    }

    this._server.get('/resources/', wrap(this._handleResources));
    this._server.get('/resources/:uuid/', wrap(this._handleResource));
    this._server.get('/resources/:uuid/persons/', wrap(this._handleRelatedPersons));
    this._server.get('/authors/', wrap(this._handleAuthors));
    this._server.get('/tags/', wrap(this._handleTags));
  }

  protected _resourceToResponse(resource: Resource): any {
    return {
      uuid: resource.uuid,
      type: 'resource',
      title: resource.title,
      titleSort: resource.titleSort,
      rating: resource.rating,
      addDate: resource.addDate ? resource.addDate.toUTCString() : null,
      lastModifyDate: resource.lastModifyDate ? resource.lastModifyDate.toUTCString() : null,
      publishDate: resource.publishDate,
      publisher: resource.publisher,
      desc: resource.desc,
    };
  }

  protected _personToResponse(person: Person): any {
    return {
      uuid: person.uuid,
      type: 'person',
      name: person.name,
      nameSort: person.nameSort,
    };
  }

  protected _groupToResponse(group: Group): any {
    return {
      uuid: group.uuid,
      type: 'group',
      title: group.title,
      titleSort: group.titleSort,
      groupType: (group.groupType as GroupType).name
    };
  }

  protected _relatedPersonToResponse(person: RelatedPerson): any {
    return {
      uuid: person.uuid,
      type: 'related_person',
      name: person.name,
      nameSort: person.nameSort,
      relation: personRelationToString(person.relation)
    };
  }

  protected async _handleResources(params: any, query: any): Promise<any> {
    let opts = this._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findResourcesByCriteria(null, opts)).map(value => this._resourceToResponse(value));
  }

  protected async _handleResource(params: any): Promise<any> {
    let uuid: string = params.uuid;

    try {
      uuid = Database.validateId(uuid);
    } catch (err) {
      throw new restifyErrors.BadRequestError(`Invalid resource identifier`);
    }

    let resource = await this._lib.libraryDatabase.getResource(uuid);
    if (resource == null) {
      throw new restifyErrors.NotFoundError('Resource does not exist');
    }

    return this._resourceToResponse(resource);
  }

  protected async _handleAuthors(): Promise<any> {
    return (await this._lib.libraryDatabase.findAuthors()).map(value => this._personToResponse(value));
  }

  protected async _handleTags(): Promise<any> {
    return (await this._lib.libraryDatabase.findTags()).map(x => this._groupToResponse(x));
  }

  protected async _handleRelatedPersons(params: any, query: any): Promise<any> {
    let resource: string = params.uuid;

    try {
      resource = Database.validateId(resource);
    } catch (err) {
      throw new restifyErrors.BadRequestError(`Invalid resource identifier`);
    }

    let relation: PersonRelation|undefined = undefined;

    if (query.relation != null) {
      if (typeof query.relation !== 'string') {
        throw new restifyErrors.BadRequestError('Multiple person relations are not supported');
      }

      try {
        relation = query.relation ? personRelationFromString(query.relation) : undefined;
      } catch (err) {
        throw new restifyErrors.BadRequestError('Invalid person relation');
      }
    }

    return (await this._lib.libraryDatabase.relatedPersons(resource, relation)).map(x => this._relatedPersonToResponse(x));
  }

  protected async _handleRelatedAuthors(params: any, query: any): Promise<any> {
    return this._handleRelatedPersons(params, { ...query, relation: 'author' });
  }

  protected _listOptionsFromQuery(query: any): ListOptions {
    let result:ListOptions = { };

    if (query.sort != null) {
      let sortRaw: string;
      if (Array.isArray(query.sort)) {
        sortRaw = query.sort.join(',').trim();
      } else if (typeof query.sort === 'string' && query.sort) {
        sortRaw = query.sort.trim();
      } else {
        throw new restifyErrors.BadRequestError('Sort option is invalid');
      }

      if (sortRaw === '-') {
        result.prefSortMode = SortMode.Desc;
      } else if (sortRaw === '+') {
        result.prefSortMode = SortMode.Asc;
      } else {
        let sortColumns:string[] = sortRaw.split(',')
            .map((x: string) => x.trim()).filter((x: string) => x.length > 0);
        if (sortColumns.length > 0) {
          result.sortProps = [];

          for (let sortCol of sortColumns) {
            let hasPlus = sortCol.startsWith('+'),
                hasMinus = sortCol.startsWith('-');

            result.sortProps.push({
              propName: (hasPlus || hasMinus) ? sortCol.slice(1).trim() : sortCol,
              sortMode: hasMinus ? SortMode.Desc : SortMode.Asc
            });
          }
        }
      }
    }

    if (query.offset != null) {
      if (!query.offset || typeof query.offset !== 'string') {
        throw new restifyErrors.BadRequestError('Offset option is invalid');
      }
      let offset = strictParseInt(query.offset);
      if (offset == null || offset < 0) {
        throw new restifyErrors.BadRequestError('Offset option is invalid: should be a positive number');
      }
      result.offset = offset;
    }

    if (query.count != null) {
      if (!query.count || typeof query.count !== 'string') {
        throw new restifyErrors.BadRequestError('Count option is invalid');
      }
      let count = strictParseInt(query.count);
      if (count == null || count < 0) {
        throw new restifyErrors.BadRequestError('Offset option is invalid: should be a positive number');
      }
      result.maxCount = count;
    }

    return result;
  }
}
