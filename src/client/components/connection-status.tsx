import * as React from "react";
import {connect} from "react-redux";
import {Connection} from "../store/store";

const ConnectionStatus = (props: { conn: Connection }): JSX.Element|null => {
  if (props.conn) {
    return null;
  } else {
    return <div>
      Connecting to library...
    </div>
  }
};

export const ConnectionStatusConnected = connect((state => {
  return {
    conn: state.conn
  }
}))(ConnectionStatus);


