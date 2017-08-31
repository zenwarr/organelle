import {Library} from "./library";
import * as restify from 'restify';
import * as restifyErrors from 'restify-errors';
import {Database} from "./db";
import {strictParseInt} from "../common/helpers";
import {
  ExistingResource, FullResourceData, ObjectRole, objectRoleFromString, personRelationFromString, AbstractDbObject, RelatedObject
} from "../common/db";
import {
  Criterion, ListOptions, CriterionEqual, CriterionAnd,
  CriterionHasRelationWith, SortMode, CriterionOneOf
} from "./library-db";
import {PersonRelation} from "../common/db";
import * as iassign from 'immutable-assign';

export const DEF_SERVER_PORT = 8080;

export class LibraryServer {
  constructor(protected _lib: Library) {
    this._server = restify.createServer();
    this._server.use(restify.plugins.queryParser());
    this._server.use((req, resp, next) => {
      resp.header('Access-Control-Allow-Origin', '*');
      resp.header('Access-Control-Allow-Headers', 'X-Requested-With');
      return next();
    });
    this._initRoutes();
  }

  start(port: number = DEF_SERVER_PORT): Promise<void> {
    return new Promise<void>(resolve => {
      this._server.listen(port, resolve);
    });
  }

  stop(): Promise<void> {
    return new Promise<void>(resolve => {
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

    function wrap(func: (...args: any[]) => Promise<any>) {
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

    this._server.get('/server-info/', wrap(this._handleServerInfo));

    // list of all registered resources
    this._server.get('/resources/', wrap(this._handleResources));

    // a single resource with uuid
    this._server.get('/resource/:uuid/', wrap(this._handleResource));

    // related persons of a single resource
    this._server.get('/resource/:uuid/persons/', wrap(this._handleRelatedPersons));

    // related persons of a specific relation (or of multiple relations) of a single resource
    this._server.get('/resource/:uuid/persons/:relations/', wrap(this._handleRelatedPersons));

    // related groups of a single resource
    this._server.get('/resource/:uuid/groups/', wrap(this._handleRelatedGroups));

    // related groups of a specific type (types) of a single resource
    this._server.get('/resource/:uuid/groups/:groupTypes/', wrap(this._handleRelatedGroups));

    // list of objects related to a single resource
    this._server.get('/resource/:uuid/objects/', wrap(this._handleRelatedObjects));

    // list of objects with a specific tag related to a single resource
    this._server.get('/resource/:uuid/objects/:tags/', wrap(this._handleRelatedObjects));

    // list of objects with specific role that are related to the resource
    this._server.get('/resource/:uuid/objects/roles/:roles/', wrap(this._handleRelatedObjects));

    // list of objects with specific tags and roles that are related to the resource
    this._server.get('/resource/:uuid/objects/:tags/roles/:roles/', wrap(this._handleRelatedObjects));

    // list of all registered groups
    this._server.get('/groups/', wrap(this._handleGroups));

    // list of groups of a specific group type (or multiple types)
    this._server.get('/groups/types/:groupTypes/', wrap(this._handleGroups));

    // list of resources that have relations with groups of specific types
    this._server.get('/groups/types/:groupTypes/resources/', wrap(this._handleGroupsResources));

    // a single group with uuid
    this._server.get('/group/:uuid/', wrap(this._handleGroup));

    // list of resources that have relations with a specific group
    this._server.get('/group/:uuid/resources/', wrap(this._handleGroupsResources));

    // list of all registered persons
    this._server.get('/persons/', wrap(this._handlePersons));

    // list of persons that have at least one relation with specific relation (or one of multiple relations)
    this._server.get('/persons/relations/:relations', wrap(this._handlePersons));

    // list of resources that have specific relation with persons
    this._server.get('/persons/relations/:relations/resources', wrap(this._handlePersonResources));

    // a single persons with specific uuid
    this._server.get('/person/:uuid', wrap(this._handlePerson));

    // list of resources that have relations with the person
    this._server.get('/person/:uuid/resources/', wrap(this._handlePersonResources));

    // list of resources that have a relation of specific type with the person
    this._server.get('/person/:uuid/relations/:relations/resources', wrap(this._handlePersonResources));

    // list of all registered objects
    this._server.get('/objects/', wrap(this._handleObjects));

    // list of all tags that related objects in the library database have
    this._server.get('/objects/tags/', wrap(this._handleObjectsTags));

    // list related objects with specific tag
    this._server.get('/objects/tags/:tags/', wrap(this._handleObjects));

    this._server.get('/locations/:uuid/', wrap(this._handleObjectLocations));
  }

  protected static _objectToResponse(obj: AbstractDbObject): any {
    switch (obj.type) {
      case 'resource':
        return iassign(obj, newObj => {
          let res = obj as ExistingResource;
          (newObj as any).addDate = res.addDate.toUTCString();
          (newObj as any).lastModifyDate = res.lastModifyDate.toUTCString();

          if ((obj as FullResourceData).relatedPersons != null) {
            let frd = obj as FullResourceData;
            (newObj as FullResourceData).relatedObjects = frd.relatedObjects.map(obj => this._objectToResponse(obj));
          }

          return newObj;
        });

      case 'related_object':
        return iassign(obj, newObj => {
          delete (newObj as RelatedObject).rowId;
          delete (newObj as RelatedObject).resourceUuid;
          return newObj;
        });
    }

    return obj;
  }

  protected static _objectTagToResponse(tag: string): any {
    return {
      type: 'object_tag',
      tag: tag
    };
  }

  protected async _handleServerInfo(): Promise<any> {
    return {
      app: 'Organelle',
      version: '1',
      name: (await this._lib.libraryDatabase.getOption('name', ''))
    };
  }

  protected async _handleResources(params: any, query: any): Promise<any> {
    let opts = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findResourcesByCriteria(null, opts)).map(value => LibraryServer._objectToResponse(value));
  }

  protected async _handleResource(params: { uuid?: string }): Promise<any> {
    let uuid: string = LibraryServer._extractUuid(params);

    let resource = await this._lib.getFullResourceData(uuid);
    if (resource == null) {
      throw new restifyErrors.ResourceNotFoundError('Resource does not exist');
    }

    return LibraryServer._objectToResponse(resource);
  }

  protected async _handleRelatedPersons(params: { uuid?: string, relations?: string }, query: any): Promise<any> {
    let resource: string = LibraryServer._extractUuid(params);

    let crit: Criterion|null = null;
    if (params.relations != null) {
      crit = this._relationsCriterion(params.relations);
    }

    let options = LibraryServer._listOptionsFromQuery(query);

    return (await this._lib.libraryDatabase.relatedPersons(resource, crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handleRelatedGroups(params: { uuid?: string, groupTypes?: string }, query: any): Promise<any> {
    let resource: string = LibraryServer._extractUuid(params);

    let crit: Criterion|null = null;
    if (params.groupTypes != null) {
      crit = this._groupTypesCriterion(params.groupTypes);
    }

    let options = LibraryServer._listOptionsFromQuery(query);

    return (await this._lib.libraryDatabase.relatedGroups(resource, crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handleRelatedObjects(params: { uuid?: string, roles?: string, tags?: string }, query: any): Promise<any> {
    let resource: string = LibraryServer._extractUuid(params);

    let crit: Criterion|null = null;
    if (params.tags != null) {
      if (typeof params.tags !== 'string') {
        throw new restifyErrors.BadRequestError('Invalid tags');
      }

      let tags: string[] = params.tags.split(',').map(input => input.trim());

      crit = new CriterionOneOf('tag', ...tags);
    }

    if (params.roles != null) {
      if (typeof params.roles !== 'string') {
        throw new restifyErrors.BadRequestError('Invalid roles');
      }

      let roles: ObjectRole[];
      try {
        roles = params.roles.split(',').map(input => objectRoleFromString(input));
      } catch (err) {
        throw new restifyErrors.BadRequestError('Invalid object role');
      }

      let roleCrit = new CriterionOneOf('role', ...roles);
      crit = crit == null ? roleCrit : new CriterionAnd(crit, roleCrit);
    }

    let options = LibraryServer._listOptionsFromQuery(query);

    return (await this._lib.libraryDatabase.relatedObjects(resource, crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handleGroups(params: { groupTypes?: string }, query: any): Promise<any> {
    let crit: Criterion|null = null;
    if (params.groupTypes != null) {
      crit = this._groupTypesCriterion(params.groupTypes);
    }

    let options = LibraryServer._listOptionsFromQuery(query);

    return (await this._lib.libraryDatabase.findGroupsByCriteria(crit, options)).map(group => LibraryServer._objectToResponse(group));
  }

  protected async _handleGroup(params: { uuid?: string }, query: any): Promise<any> {
    let uuid: string = LibraryServer._extractUuid(params);

    let group = await this._lib.libraryDatabase.getGroup(uuid);
    if (!group) {
      throw new restifyErrors.ResourceNotFoundError();
    }

    return LibraryServer._objectToResponse(group);
  }

  protected async _handleGroupsResources(params: { uuid?: string, groupTypes?: string }, query: any): Promise<any> {
    let crit: Criterion|null = null;
    if (params.uuid != null) {
      crit = new CriterionEqual('groups#uuid', LibraryServer._extractUuid(params));
    } else if (params.groupTypes != null) {
      let gtCrit = this._groupTypesCriterion(params.groupTypes, 'groups');
      crit = crit == null ? gtCrit : new CriterionAnd(crit, gtCrit);
    } else {
      throw new restifyErrors.BadRequestError('No uuid and no group types specified in the request');
    }

    let options = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findResourcesByCriteria(crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handlePersons(params: { relations?: string }, query: any): Promise<any> {
    let crit: Criterion|null = null;
    if (params.relations != null) {
      crit = new CriterionHasRelationWith(this._relationsCriterion(params.relations));
    }

    let options = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findPersonsByCriteria(crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handlePersonResources(params: { uuid?: string, relations?: string }, query: any): Promise<any> {
    let crit: Criterion|null = null;

    if (params.uuid != null) {
      crit = new CriterionEqual('persons#uuid', LibraryServer._extractUuid(params));
    }

    if (params.relations != null) {
      let relCrit = this._relationsCriterion(params.relations, 'persons');
      crit = crit == null ? relCrit : new CriterionAnd(crit, relCrit);
    }

    let options = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findResourcesByCriteria(crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handlePerson(params: { uuid?: string}, query: any): Promise<any> {
    let uuid: string = LibraryServer._extractUuid(params);
    let person = await this._lib.libraryDatabase.getPerson(uuid);
    if (!person) {
      throw new restifyErrors.ResourceNotFoundError(`Person does not exist`);
    }
    return LibraryServer._objectToResponse(person);
  }

  protected async _handleObjects(params: { tags?: string }, query: any): Promise<any> {
    let crit: Criterion|null = null;

    if (params.tags != null) {
      if (typeof params.tags !== 'string') {
        throw new restifyErrors.BadRequestError('Invalid object tags');
      }

      let tagList = params.tags.split(',').map(tag => tag.toLowerCase().trim());

      crit = new CriterionOneOf('tag', ...tagList);
    }

    let options = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.findObjectsByCriteria(crit, options)).map(x => LibraryServer._objectToResponse(x));
  }

  protected async _handleObjectLocations(params: { uuid?: string }): Promise<any> {
    let uuid = LibraryServer._extractUuid(params);

    let result: { type: string, location: string }[] = [];
    for (let loc of this._lib.objectLocations(uuid)) {
      result.push({
        type: 'object_location',
        location: await loc
      });
    }
    return result;
  }

  protected async _handleObjectsTags(params: any, query: any): Promise<any> {
    let options = LibraryServer._listOptionsFromQuery(query);
    return (await this._lib.libraryDatabase.getObjectsTags(options)).map(x => LibraryServer._objectTagToResponse(x));
  }

  protected _groupTypesCriterion(gtNames: string, prefix?: string): Criterion {
    if (typeof gtNames !== 'string') {
      throw new restifyErrors.BadRequestError('Invalid group types');
    }

    let groupTypes = gtNames.split(',').map(gt => {
      let groupType = this._lib.libraryDatabase.getGroupTypeByName(gt);
      if (!groupType) {
        throw new restifyErrors.BadRequestError(`Invalid group type name: ${gt}`);
      }
      return groupType;
    });

    let prop = prefix ? prefix + '#groupType' : 'groupType';
    return new CriterionOneOf(prop, ...groupTypes);
  }

  protected _relationsCriterion(relationNames: string, prefix?: string): Criterion {
    if (typeof relationNames !== 'string') {
      throw new restifyErrors.BadRequestError('Invalid person relation');
    }

    let relationList: PersonRelation[] = relationNames.split(',').map(input => {
      try {
        return personRelationFromString(input);
      } catch (err) {
        throw new restifyErrors.BadRequestError(`Invalid person relation: ${input}`);
      }
    });

    let prop = prefix ? prefix + '#relation' : 'relation';
    return new CriterionOneOf(prop, ...relationList);
  }

  protected static _listOptionsFromQuery(query: any): ListOptions {
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

  protected static _extractUuid(obj: { uuid?: string} ): string {
    try {
      return Database.validateId(obj.uuid);
    } catch (err) {
      throw new restifyErrors.BadRequestError('Invalid group uuid');
    }
  }
}
