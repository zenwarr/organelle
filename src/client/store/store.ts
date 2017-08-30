import * as redux from 'redux';
import * as request from 'superagent';
import {FullResourceData} from "../../common/db";
import * as iassign from 'immutable-assign';

/** Top-level application store **/

export interface AppState {
  connection: ConnectionState;
  operations: OperationsState;
  shelf: ShelfState;
}

export interface ConnectionState {
  host: string;
  isConnected: boolean;
}

export interface OperationsState {
  pendingCount: number;
  lastError: string;
}

export interface ShelfState {
  activeResource: FullResourceData|null;
  shelfResults: FullResourceData[]|null;
  activeIndex: number;
}

/** Reducers **/

function asyncDone(action: IGenericAction): boolean {
  return !action.async || (!(action as IAsyncAction).pending && !(action as IAsyncAction).error);
}

function operations(prev: OperationsState, action: IGenericAction): OperationsState {
  if (prev == null) {
    return {
      pendingCount: 0,
      lastError: ''
    };
  }

  if (action.async) {
    let asyncAction = action as IAsyncAction;
    return iassign(prev, prev => {
      prev.pendingCount = asyncAction.pending ? prev.pendingCount + 1 : prev.pendingCount - 1;
      prev.lastError = asyncAction.error ? asyncAction.error : '';
      return prev;
    });
  }
  return prev;
}

function connection(prev: ConnectionState, action: IAsyncAction): ConnectionState {
  if (prev == null) {
    return {
      host: 'http://localhost:8080',
      isConnected: false,
    };
  }

  if (action.type === AC_CONNECT && !action.pending && !action.error) {
    return iassign(prev, prev => {
      prev.isConnected = true;
      return prev;
    });
  }
  return prev;
}

function shelf(prev: ShelfState, action: IGenericAction): ShelfState {
  if (prev == null) {
    return {
      activeResource: null,
      shelfResults: null,
      activeIndex: -1
    };
  }

  switch (action.type) {
    case AC_LOAD_SHELF: {
      if (asyncDone(action)) {
        return iassign(prev, prev => {
          prev.shelfResults = (action as IAsyncAction).result;
          return prev;
        })
      }
    } break;

    case AC_LOAD_RESOURCE: {
      if (asyncDone(action)) {
        return iassign(prev, prev => {
          prev.activeResource = (action as IAsyncAction).result;
          return prev;
        })
      }
    } break;

    case AC_SELECT_RESOURCE:
      return iassign(prev, prev => {
        prev.activeIndex = (action as ISelectResourceAction).index;
        return prev;
      })
  }

  return prev;
}

const reducer = redux.combineReducers({
  operations,
  connection,
  shelf
});

let appStore: redux.Store<AppState>;

export function getStore(): redux.Store<AppState> {
  return appStore ? appStore : (appStore = redux.createStore(reducer,
      (window as any)['__REDUX_DEVTOOLS_EXTENSION__'] && (window as any)['__REDUX_DEVTOOLS_EXTENSION__']()));
}

export function apiUrl(path: string): string {
  let state = getStore().getState();
  if (state.connection.host) {
    return state.connection.host + (path.startsWith('/') ? '' : '/') + path;
  } else {
    throw new Error('No connection to a library');
  }
}

/** Actions **/

export const AC_NOP = 'AC_NOP';
export const AC_CONNECT = 'AC_CONNECT';
export const AC_LOAD_SHELF = 'AC_LOAD_SHELF';
export const AC_LOAD_RESOURCE = 'AC_LOAD_RESOURCE';
export const AC_SELECT_RESOURCE = 'AC_SELECT_RESOURCE';

interface IGenericAction extends redux.Action {
  async?: boolean;
}

interface IAsyncAction extends IGenericAction {
  async: boolean;
  pending: boolean;
  error: string|null;
  result: any;
}

interface ISelectResourceAction extends IGenericAction {
  index: number;
}

export function makeApiAction(path: string, actionType: string): IAsyncAction {
  let getAction: IAsyncAction = {
    async: true,
    type: actionType,
    pending: true,
    error: null,
    result: null
  };

  request.get(apiUrl(path)).then((resp: request.Response) => {
    if (resp.status === 200) {
      let successAction: IAsyncAction = {
        async: true,
        type: actionType,
        pending: false,
        error: null,
        result: resp.body
      };
      getStore().dispatch(successAction);
    } else {
      let errAction: IAsyncAction = {
        async: true,
        type: actionType,
        pending: false,
        error: resp.body.error,
        result: null
      };
      getStore().dispatch(errAction);
    }
  }, (err: Error) => {
    let errAction: IAsyncAction = {
      async: true,
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
  if (!getStore().getState().connection.isConnected) {
    return makeApiAction('/server-info/', AC_CONNECT);
  } else {
    return { type: AC_NOP };
  }
};
export const getShelfResults = makeApiAction.bind(null, '/resources/', AC_LOAD_SHELF);
export const loadResource = (uuid: string): IAsyncAction => {
  return makeApiAction(`/resource/${uuid}`, AC_LOAD_RESOURCE);
};
export const selectResource = (index: number): ISelectResourceAction => {
  return {
    type: AC_SELECT_RESOURCE,
    index
  }
};
