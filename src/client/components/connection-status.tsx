import * as React from "react";
import {connect} from "react-redux";
import {ConnectionRecord} from "../store/store";

const ConnectionStatus = (props: { conn: ConnectionRecord }): JSX.Element|null => {
  if (props.conn) {
    return null;
  } else {
    return <div>
      Connecting to library...
    </div>
  }
};

export const CConnectionStatus = connect((state => {
  return {
    conn: state.conn
  };
}))(ConnectionStatus);
