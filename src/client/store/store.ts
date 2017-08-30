import * as redux from 'redux';
import * as request from 'superagent';
import {FullResourceData} from "../../common/db";
import * as iassign from 'immutable-assign';

/** Top-level application store **/

export interface AppState {
  conn: Connection;
  activeResource: FullResourceData|null;
  shelfResults: FullResourceData[]|null;
  message: string;
  operationPending: boolean;
}

const initialState: AppState = {
  conn: {
    host: 'http://localhost:8080',
    isConnected: false
  },
  activeResource: null,
  shelfResults: null,
  message: '',
  operationPending: false
};

export interface Connection {
  host: string;
  isConnected: boolean;
}

/** Redux shit **/

function apiCallReducer(key: string, defValue: any, prev: AppState, action: redux.Action): AppState {
  let keyPath = key.split('.');

  function applyKeys(root: any, value: any, ...keys: string[]): void {
    if (keys.length === 1) {
      root[keys[0]] = value;
    } else if (keys.length > 1) {
      applyKeys(root[keys[0]], value, ...keys.slice(1));
    } else {
      throw new Error();
    }
  }

  function apply(root: any, value: any): void {
    applyKeys(root, value, ...keyPath);
  }

  let asyncAction = action as IAsyncAction;
  if (!asyncAction.pending && !asyncAction.error) {
    return iassign(prev, prev => {
      apply(prev, asyncAction.result);
      prev.operationPending = false;
      prev.message = '';
      return prev;
    });
  } else {
    return iassign(prev, prev => {
      apply(prev, defValue);
      prev.operationPending = asyncAction.pending;
      prev.message = asyncAction.error ? asyncAction.error : '';
      return prev;
    });
  }
}

function reducer(prev: AppState, action: redux.Action): AppState {
  if (prev == null) {
    return initialState;
  } else {
    switch (action.type) {
      case AC_MESSAGE:
        return iassign(prev, prev => {
          prev.message = (action as IMessageAction).text;
          return prev;
        });

      case AC_CONNECT:
        return apiCallReducer('conn.isConnected', false, prev, action);

      case AC_LOAD_SHELF:
        return apiCallReducer('shelfResults', [], prev, action);

      case AC_LOAD_RESOURCE:
        return apiCallReducer('activeResource', null, prev, action);

      default:
        return prev;
    }
  }
}

let appStore: redux.Store<AppState>;

export function getStore(): redux.Store<AppState> {
  return appStore ? appStore : (appStore = redux.createStore(reducer,
      (window as any)['__REDUX_DEVTOOLS_EXTENSION__'] && (window as any)['__REDUX_DEVTOOLS_EXTENSION__']()));
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

export const AC_NOP = 'AC_NOP';
export const AC_MESSAGE = 'AC_MESSAGE';
export const AC_CONNECT = 'AC_CONNECT';
export const AC_LOAD_SHELF = 'AC_LOAD_SHELF';
export const AC_LOAD_RESOURCE = 'AC_LOAD_RESOURCE';

interface IMessageAction extends redux.Action {
  text: string;
}

interface IAsyncAction extends redux.Action {
  pending: boolean;
  error: string|null;
  result: any;
}

export function doMessage(text: string): IMessageAction {
  return {
    type: AC_MESSAGE,
    text: text
  };
}

export function makeApiAction(path: string, actionType: string): IAsyncAction {
  let getAction: IAsyncAction = {
    type: actionType,
    pending: true,
    error: null,
    result: null
  };

  request.get(apiUrl(path)).then((resp: request.Response) => {
    if (resp.status === 200) {
      let successAction: IAsyncAction = {
        type: actionType,
        pending: false,
        error: null,
        result: resp.body
      };
      getStore().dispatch(successAction);
    } else {
      let errAction: IAsyncAction = {
        type: actionType,
        pending: false,
        error: resp.body.error,
        result: null
      };
      getStore().dispatch(errAction);
    }
  }, (err: Error) => {
    let errAction: IAsyncAction = {
      type: actionType,
      pending: false,
      error: err.message,
      result: null
    };
    getStore().dispatch(errAction);
  });

  return getAction;
}

export const doConnect = (): redux.Action => {
  if (!getStore().getState().conn.isConnected) {
    return makeApiAction('/server-info/', AC_CONNECT);
  } else {
    return { type: AC_NOP };
  }
};
export const getShelfResults = makeApiAction.bind(null, '/resources/', AC_LOAD_SHELF);
export const loadResource = (uuid: string): IAsyncAction => {
  return makeApiAction(`/resource/${uuid}`, AC_LOAD_RESOURCE);
};
