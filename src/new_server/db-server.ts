import {Database, FindOptions, Model, SortOrder} from "./db";
import * as restify from 'restify';
import * as restifyErrors from 'restify-errors';
import {strictParseInt} from "../common/helpers";

export class DatabaseServer {
  constructor(protected _db: Database, protected _port: number = 9999) {
    if (!this._db) {
      throw new Error('Invalid database');
    }
    if (!this._port) {
      throw new Error('Invalid port');
    }

    this._server = restify.createServer();
    this._server.use(restify.plugins.queryParser());
    this._server.use((req, resp, next) => {
      resp.header('Access-Control-Allow-Origin', '*');
      resp.header('Access-Control-Allow-Headers', 'X-Requested-With');
      return next();
    });

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

    this._server.get('/:model/', wrap(this._handleModel));
  }

  async start(): Promise<void> {
    return new Promise<void>(resolve => {
      this._server.listen(this._port, resolve);
    });
  }

  async stop(): Promise<void> {
    return new Promise<void>(resolve => {
      this._server.once('close', () => {
        resolve();
      });
      this._server.close();
    });
  }

  get port(): number { return this._port; }
  get db(): Database { return this._db; }
  get server(): restify.Server|null { return this._server; }

  /** Protected area **/

  protected _server: restify.Server;

  protected async _handleModel(params: { model?: string }, query: any): Promise<any> {
    if (!params.model) {
      throw new restifyErrors.BadRequestError("Invalid model");
    }

    let model = this._db.getModel(params.model);
    if (!model) {
      throw new restifyErrors.ResourceNotFoundError("Model not found");
    }

    let options = DatabaseServer._findOptionsFromQuery(model, query);

    let result = await model.find(options);
    return {
      errors: null,
      data: {
        totalCount: result.totalCount,
        items: result.items.map(item => item.$json())
      }
    };
  }

  protected static _findOptionsFromQuery(model: Model<any>, query: any): FindOptions {
    let result: FindOptions = { };

    if (query.sort != null) {
      let sortRaw: string;
      if (Array.isArray(query.sort)) {
        sortRaw = query.sort.join(',').trim();
      } else if (typeof query.sort === 'string' && query.sort) {
        sortRaw = query.sort.trim();
      } else {
        throw new restifyErrors.BadRequestError('Sort option is invalid');
      }

      if (sortRaw === '-' || sortRaw === '+') {
        // change the order of the default sorting
        // get default sorting property
        let defSorting = model.defaultSorting;
        if (defSorting == null) {
          throw new restifyErrors.BadRequestError('Sort option is invalid: the current model has no default sorting property');
        }
        result.sort = [{
          by: defSorting.by,
          order: sortRaw === '-' ? SortOrder.Desc : SortOrder.Asc,
          caseSensitive: defSorting.caseSensitive
        }];
      } else {
        let sortColumns:string[] = sortRaw.split(',')
            .map((x: string) => x.trim()).filter((x: string) => x.length > 0);
        if (sortColumns.length > 0) {
          result.sort = [];

          for (let sortCol of sortColumns) {
            let hasPlus = sortCol.startsWith('+'),
                hasMinus = sortCol.startsWith('-');

            result.sort.push({
              by: (hasPlus || hasMinus) ? sortCol.slice(1).trim() : sortCol,
              order: hasMinus ? SortOrder.Desc : SortOrder.Asc
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
      result.limit = count;
    }

    if (query.fetchTotal != null || query.fetchTotalCount != null) {
      result.fetchTotalCount = true;
    }

    return result;
  }
}
