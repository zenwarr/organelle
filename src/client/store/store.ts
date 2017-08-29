import * as redux from 'redux';
import * as request from 'superagent';
import {FullResourceData} from "../../common/db";
import * as iassign from 'immutable-assign';;

/** Top-level application store **/

export interface Store {
  conn: Connection;
  activeResource: FullResourceData|null;
  shelfResults: FullResourceData[];
  message: string;
  operationPending: boolean;
}

const initialState: Store = {
  conn: {
    host: 'http://localhost:8080'
  },
  activeResource: null,
  shelfResults: [],
  message: '',
  operationPending: false
};

export interface Connection {
  host: string;
}

/** Redux shit **/

function apiCallReducer(key: string, adapter: null, defValue: any, prev: Store, action: redux.Action): Store {
  let asyncAction = action as IAsyncAction;
  if (!asyncAction.pending && !asyncAction.error) {
    return iassign(prev, prev => {
      (prev as any)[key] = asyncAction.result;
      prev.operationPending = false;
      prev.message = '';
      return prev;
    });
  } else {
    return iassign(prev, prev => {
      prev.operationPending = asyncAction.pending;
      prev.message = asyncAction.error ? asyncAction.error : '';
      (prev as any)[key] = defValue;
      return prev;
    });
  }
}

function reducer(prev: Store, action: redux.Action): Store {
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
        return iassign(prev, prev => {
          prev.operationPending = (action as IAsyncAction).pending;
          return prev;
        });

      case AC_LOAD_SHELF:
        return apiCallReducer('shelfResults', null, [], prev, action);

      case AC_LOAD_RESOURCE:
        return apiCallReducer('activeResource', null, null, prev, action);

      default:
        return prev;
    }
  }
}

let appStore: redux.Store<Store>;

export function getStore(): redux.Store<Store> {
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

export const getShelfResults = makeApiAction.bind(null, '/resources/', AC_LOAD_SHELF);
export const loadResource = (uuid: string): IAsyncAction => {
  return makeApiAction(`/resource/${uuid}`, AC_LOAD_RESOURCE);
};
