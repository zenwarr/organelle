import {Library} from "./library";
import * as url from 'url';
import {Database} from "./db";
import {Group, GroupType, Person, personRelationToString, RelatedPerson, Resource} from "./library-db";

export interface ApiResponse {
  errors: {
    code?: string,
    detail?: string,
  }[],
  data?: any
}

interface Query {
  uri: string;
  path: string;
}

export class ApiError extends Error {
  constructor(msg: string, public errCode?: ErrorCode) {
    super(msg);
  }
}

enum ErrorCode {
  ApiPathInvalid = 'ER_API_PATH_INVALID',
  NotImplemented = 'ER_NOT_IMPLEMENTED',
  InvalidArgument = 'ER_INVALID_ARGUMENT',
  NotExists = 'ER_DOES_NOT_EXIST',
}

type RouteHandler = (...args: string[]) => Promise<any>;

interface RouteData {
  regex: RegExp,
  handler: RouteHandler
}

export class LibraryServer {
  constructor(protected _lib: Library) {
    this._initRoutes();
  }

  async handle(query: Query|string): Promise<ApiResponse> {
    if (typeof query === 'string') {
      query = {
        uri: '',
        path: query.toLowerCase()
      };
    }

    let apiData: any;
    try {
      let found: boolean = false;
      for (let j = 0; j < this.ROUTES.length; j++) {
        let route = this.ROUTES[j];
        let match = query.path.match(route.regex);
        if (match) {
          apiData = await route.handler(...match.slice(1));
          found = true;
        }
      }

      if (!found) {
        throw new ApiError('API path is invalid', ErrorCode.ApiPathInvalid);
      }

      if (apiData == null) {
        apiData = [];
      }

      return {
        errors: [],
        data: apiData
      };
    } catch (err) {
      return {
        errors: [
          {
            code: (err.errCode ? '' + err.errCode : 'ER_GENERIC'),
            detail: err.message
          }
        ]
      };
    }
  }

  /** Protected area **/

  protected ROUTES: RouteData[];

  protected _initRoutes(): void {
    this.ROUTES = [
      {
        regex: new RegExp('^/resources/$'),
        handler: this._handleResources.bind(this)
      },
      {
        regex: new RegExp('^/resources/([a-z0-9\-]+)/$'),
        handler: this._handleResource.bind(this)
      },
      {
        regex: new RegExp('^/authors/$'),
        handler: this._handleAuthors.bind(this)
      },
      {
        regex: new RegExp('^/tags/$'),
        handler: this._handleTags.bind(this)
      },
      {
        regex: new RegExp('^/resources/([a-z0-9\-]+)/persons/$'),
        handler: this._handleRelatedPersons.bind(this)
      }
    ];
  }

  protected _resourceToResponse(resource: Resource): any {
    return {
      id: resource.uuid,
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
      id: person.uuid,
      type: 'person',
      name: person.name,
      nameSort: person.nameSort,
    };
  }

  protected _groupToResponse(group: Group): any {
    return {
      id: group.uuid,
      type: 'group',
      title: group.title,
      titleSort: group.titleSort,
      groupType: (group.groupType as GroupType).name
    };
  }

  protected _relatedPersonToResponse(person: RelatedPerson): any {
    return {
      id: person.uuid,
      type: 'related_person',
      name: person.name,
      nameSort: person.nameSort,
      relation: personRelationToString(person.relation)
    };
  }

  protected async _handleResources(): Promise<any> {
    return (await this._lib.libraryDatabase.findResources()).map(value => this._resourceToResponse(value));
  }

  protected async _handleResource(uuid: string): Promise<any> {
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

  protected async _handleRelatedPersons(resource: string): Promise<any> {
    try {
      resource = Database.validateId(resource);
    } catch (err) {
      throw new ApiError(`Invalid argument: ${resource}`, ErrorCode.InvalidArgument);
    }

    return (await this._lib.libraryDatabase.relatedPersons(resource)).map(x => this._relatedPersonToResponse(x));
  }
}
