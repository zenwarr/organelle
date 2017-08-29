import * as React from "react";
import {connect} from "react-redux";
import {Connection, Store} from "../../store/store";

const ConnectionStatus = (props: { conn: Connection }): JSX.Element|null => {
  if (props.conn) {
    return null;
  } else {
    return <div>
      Connecting to library...
    </div>
  }
};

export const CConnectionStatus = connect((state: Store) => {
  return {
    conn: state.conn
  };
})(ConnectionStatus);
