import * as redux from 'redux';
import {ExistingResource, FullResourceData} from "../../common/db";
import {getReducer} from "./reducers";

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
  shelfResults: ExistingResource[]|null;
  activeIndex: number;
}

let appStore: redux.Store<AppState>;

export function getStore(): redux.Store<AppState> {
  return appStore ? appStore : (appStore = redux.createStore(getReducer(),
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
