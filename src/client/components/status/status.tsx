import {AppState} from "../../store/store";
import {connect} from "react-redux";
import * as React from 'react';
require('./status.scss');

interface StatusBarProps {
  message: string;
  operationPending: boolean;
}

export const StatusBar = (props: StatusBarProps): JSX.Element => {
  return <div className="status-bar">
    {props.message} {props.operationPending && "..."}
  </div>
};

export const CStatusBar = connect((state: AppState) => {
  return {
    message: state.message,
    operationPending: state.operationPending
  };
})(StatusBar);
