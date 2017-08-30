import {combineReducers, Reducer} from "redux";
import {AppState, OperationsState, ConnectionState, ShelfState} from "./store";
import * as iassign from 'immutable-assign';
import * as actions from './actions';

function asyncDone(action: actions.IGenericAction): boolean {
  return !action.async || (!(action as actions.IAsyncAction).pending && !(action as actions.IAsyncAction).error);
}

function operations(prev: OperationsState, action: actions.IGenericAction): OperationsState {
  if (prev == null) {
    return {
      pendingCount: 0,
      lastError: ''
    };
  }

  if (action.async) {
    let asyncAction = action as actions.IAsyncAction;
    return iassign(prev, prev => {
      prev.pendingCount = asyncAction.pending ? prev.pendingCount + 1 : prev.pendingCount - 1;
      prev.lastError = asyncAction.error ? asyncAction.error : '';
      return prev;
    });
  }
  return prev;
}

function connection(prev: ConnectionState, action: actions.IAsyncAction): ConnectionState {
  if (prev == null) {
    return {
      host: 'http://localhost:8080',
      isConnected: false,
    };
  }

  if (action.type === actions.AC_CONNECT && !action.pending && !action.error) {
    return iassign(prev, prev => {
      prev.isConnected = true;
      return prev;
    });
  }
  return prev;
}

function shelf(prev: ShelfState, action: actions.IGenericAction): ShelfState {
  if (prev == null) {
    return {
      activeResource: null,
      shelfResults: null,
      activeIndex: -1
    };
  }

  switch (action.type) {
    case actions.AC_LOAD_SHELF: {
      if (asyncDone(action)) {
        return iassign(prev, prev => {
          let result = (action as actions.IAsyncAction).result;
          prev.shelfResults = result;
          if (result && result.length > 0) {
            if (prev.activeIndex < 0) {
              prev.activeIndex = 0;
            } else if (prev.activeIndex >= result.length) {
              prev.activeIndex = result.length - 1;
            }
          } else {
            prev.activeIndex = -1;
          }
          return prev;
        })
      }
    } break;

    case actions.AC_LOAD_RESOURCE: {
      if (asyncDone(action)) {
        return iassign(prev, prev => {
          prev.activeResource = (action as actions.IAsyncAction).result;
          return prev;
        })
      }
    } break;

    case actions.AC_UNLOAD_RESOURCE:
      return iassign(prev, prev => {
        prev.activeResource = null;
        return prev;
      });

    case actions.AC_SELECT_RESOURCE:
      return iassign(prev, prev => {
        prev.activeIndex = (action as actions.ISelectResourceAction).index;
        return prev;
      });
  }

  return prev;
}

let reducer: Reducer<AppState>|null = null;
export function getReducer(): Reducer<AppState> {
  if (reducer == null) {
    reducer = combineReducers({
      operations,
      connection,
      shelf
    });
  }
  return reducer;
}
