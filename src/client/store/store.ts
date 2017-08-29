import {recordify, TypedRecord} from "typed-immutable-record";
import * as redux from 'redux';
import * as Immutable from 'immutable';
import request = require("superagent");
import {FullResourceData} from "../../common/db";

/** Top-level application store **/

interface Store {
  conn: ConnectionRecord|null;
  activeResource: FullResourceDataRecord|null;
  shelfResults: Immutable.List<FullResourceDataRecord>;
  message: string;
  operationPending: boolean;
}

export interface StoreRecord extends TypedRecord<StoreRecord>, Store { }

const initialState: StoreRecord = recordify<Store, StoreRecord>({
  conn: recordify<Connection, ConnectionRecord>({
    host: 'http://localhost:8080'
  }),
  activeResource: null,
  shelfResults: Immutable.List(),
  message: '',
  operationPending: false
});

/** Connection data **/

interface Connection {
  host: string;
}

export interface ConnectionRecord extends TypedRecord<ConnectionRecord>, Connection { }

/** Wrap FullResourceData to Immutable **/

export interface FullResourceDataRecord extends TypedRecord<FullResourceDataRecord>, FullResourceData { }

/** Redux shit **/

function reducer(prev: StoreRecord, action: redux.Action): StoreRecord {
  if (prev == null) {
    return initialState;
  } else {
    switch (action.type) {
      case AC_MESSAGE:
        return prev.set('message', (action as IMessageAction).text);

      case AC_CONNECT:
        return prev.set('operationPending', (action as IAsyncAction).pending);

      case AC_LOAD_SHELF: {
        let loadAction = action as IAsyncAction;
        if (!loadAction.pending && !loadAction.error) {
          return prev.set('shelfResults', loadAction.result);
        } else {
          return prev.set('operationPending', loadAction.pending).set('message', loadAction.error);
        }
      }

      case AC_ACTIVATE_RESOURCE:
        return prev.set('activeResource', (action as ActivateResourceAction).res);

      default:
        return prev;
    }
  }
}

let appStore: redux.Store<StoreRecord>;

export function getStore(): redux.Store<StoreRecord> {
  return appStore ? appStore : (appStore = redux.createStore(reducer));
}

export function apiUrl(path: string): string {
  let state = getStore().getState();
  if (!state.conn) {
    throw new Error('No connection to a library');
  } else {
    return state.conn.host + (path.startsWith('/') ? '' : '/') + path;
  }
}

/** Actions **/

export const AC_MESSAGE = 'AC_MESSAGE';
export const AC_CONNECT = 'AC_CONNECT';
export const AC_LOAD_SHELF = 'AC_LOAD_SHELF';
export const AC_ACTIVATE_RESOURCE = 'AC_ACTIVATE_RESOURCE';

interface IMessageAction extends redux.Action {
  text: string;
}

interface IAsyncAction extends redux.Action {
  pending: boolean;
  error: string|null;
  result: any;
}

interface ActivateResourceAction extends redux.Action {
  res: FullResourceDataRecord;
}

export function doMessage(text: string): IMessageAction {
  return {
    type: AC_MESSAGE,
    text: text
  };
}

export function getShelfResults(): IAsyncAction {
  let getAction: IAsyncAction = {
    type: AC_LOAD_SHELF,
    pending: true,
    error: null,
    result: null
  };

  request.get(apiUrl('/resources/')).then((resp: request.Response) => {
    if (resp.status === 200) {
      let succAction: IAsyncAction = {
        type: AC_LOAD_SHELF,
        pending: false,
        error: null,
        result: Immutable.List(resp.body)
      };
      getStore().dispatch(succAction);
    } else {
      let errAction: IAsyncAction = {
        type: AC_LOAD_SHELF,
        pending: false,
        error: resp.body.error,
        result: null
      };
      getStore().dispatch(errAction);
    }
  }, (err: Error) => {
    let errAction: IAsyncAction = {
      type: AC_LOAD_SHELF,
      pending: false,
      error: err.message,
      result: null
    };
    getStore().dispatch(errAction);
  });

  return getAction;
}

export function activateResource(res: FullResourceDataRecord): ActivateResourceAction {
  return {
    type: AC_ACTIVATE_RESOURCE,
    res
  };
}
