import {AppState} from "../../store/store";
import {connect} from "react-redux";
import * as React from 'react';
require('./status.scss');

interface StatusBarProps {
  message: string;
  pendingCount: number;
}

export const StatusBar = (props: StatusBarProps): JSX.Element => {
  return <div className="status-bar">
    {props.message} Pending operations: {props.pendingCount}
  </div>
};

export const CStatusBar = connect((state: AppState) => {
  return {
    message: state.operations.lastError,
    pendingCount: state.operations.pendingCount
  };
})(StatusBar);
