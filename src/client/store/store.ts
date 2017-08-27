import {recordify, TypedRecord} from "typed-immutable-record";
import * as redux from 'redux';
import {FullResourceData} from "../../server/library-db";
import * as Immutable from 'immutable';

export interface Store {
  conn: ConnectionRecord|null;
  activeResource: FullResourceDataRecord|null;
  shelfResults: Immutable.List<FullResourceDataRecord>;
}

export interface StoreRecord extends TypedRecord<StoreRecord>, Store { }

export interface Connection {
  host: string;
}

export interface ConnectionRecord extends TypedRecord<ConnectionRecord>, Connection { }

export interface FullResourceDataRecord extends TypedRecord<FullResourceDataRecord>, FullResourceData { }

const initialState: StoreRecord = recordify<Store, StoreRecord>({
  conn: null,
  activeResource: null,
  shelfResults: Immutable.List()
});

function reducer(prev: StoreRecord, action: redux.Action): StoreRecord {
  if (prev == null) {
    return initialState;
  } else {
    return prev;
  }
}

export function initStore(): redux.Store<StoreRecord> {
  return redux.createStore(reducer);
}
