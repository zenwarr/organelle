import {Store} from "../../store/store";
import {connect} from "react-redux";
import * as React from 'react';

interface StatusBarProps {
  message: string;
  operationPending: boolean;
}

export const StatusBar = (props: StatusBarProps): JSX.Element => {
  return <div>
    {props.message} {props.operationPending && "..."}
  </div>
};

export const CStatusBar = connect((state: Store) => {
  return {
    message: state.message,
    operationPending: state.operationPending
  };
})(StatusBar);
