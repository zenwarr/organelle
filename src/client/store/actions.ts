import {Action} from "redux";
import {apiUrl, getStore} from "./store";
import * as request from 'superagent';

export const AC_NOP = 'AC_NOP';
export const AC_CONNECT = 'AC_CONNECT';
export const AC_LOAD_SHELF = 'AC_LOAD_SHELF';
export const AC_LOAD_RESOURCE = 'AC_LOAD_RESOURCE';
export const AC_UNLOAD_RESOURCE = 'AC_UNLOAD_RESOURCE';
export const AC_SELECT_RESOURCE = 'AC_SELECT_RESOURCE';

export interface IGenericAction extends Action {
  async?: boolean;
}

export interface IAsyncAction extends IGenericAction {
  async: boolean;
  pending: boolean;
  error: string|null;
  result: any;
}

export interface ISelectResourceAction extends IGenericAction {
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

export const doConnect = (): Action => {
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
export const unloadResource = (): IGenericAction => {
  return {
    type: AC_UNLOAD_RESOURCE
  };
};
