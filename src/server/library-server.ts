import {Library} from "./library";
import * as restify from 'restify';
import * as restifyErrors from 'restify-errors';
import {Database} from "./db";
import {Group, GroupType, Person, personRelationToString, RelatedPerson, Resource} from "./library-db";

export class ApiError extends Error {
  constructor(msg: string, public errCode?: ErrorCode) {
    super(msg);
  }
}

enum ErrorCode {
  NotImplemented = 'ER_NOT_IMPLEMENTED',
  InvalidArgument = 'ER_INVALID_ARGUMENT',
  NotExists = 'ER_DOES_NOT_EXIST',
}

export const DEF_SERVER_PORT = 8080;

export class LibraryServer {
  constructor(protected _lib: Library) {
    this._server = restify.createServer();
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
        func.call(self, req.params).then((apiResponse: any) => {
          resp.json(200, apiResponse);
          next();
        }, (err: ApiError) => {
          switch (err.errCode) {
            case ErrorCode.NotImplemented: {
              next(new restifyErrors.NotImplementedError(err.message));
            } break;

            case ErrorCode.InvalidArgument: {
              next(new restifyErrors.BadRequestError(err.message));
            } break;

            case ErrorCode.NotExists: {
              next(new restifyErrors.NotFoundError(err.message));
            } break;

            default: {
              next(new restifyErrors.InternalServerError(err.message));
            }
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

  protected async _handleResources(): Promise<any> {
    return (await this._lib.libraryDatabase.findResources()).map(value => this._resourceToResponse(value));
  }

  protected async _handleResource(params: any): Promise<any> {
    let uuid: string = params.uuid;

    try {
      uuid = Database.validateId(uuid);
    } catch (err) {
      throw new ApiError(`Invalid argument: ${uuid}`, ErrorCode.InvalidArgument);
    }

    let resource = await this._lib.libraryDatabase.getResource(uuid);
    if (resource == null) {
      throw new ApiError('Resource does not exist', ErrorCode.NotExists);
    }

    return this._resourceToResponse(resource);
  }

  protected async _handleAuthors(): Promise<any> {
    return (await this._lib.libraryDatabase.findAuthors()).map(value => this._personToResponse(value));
  }

  protected async _handleTags(): Promise<any> {
    return (await this._lib.libraryDatabase.findTags()).map(x => this._groupToResponse(x));
  }

  protected async _handleRelatedPersons(params: any): Promise<any> {
    let resource: string = params.uuid;

    try {
      resource = Database.validateId(resource);
    } catch (err) {
      throw new ApiError(`Invalid argument: ${resource}`, ErrorCode.InvalidArgument);
    }

    return (await this._lib.libraryDatabase.relatedPersons(resource)).map(x => this._relatedPersonToResponse(x));
  }
}
