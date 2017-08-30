import * as React from "react";
import {connect} from "react-redux";
import {doConnect, AppState} from "../../store/store";
require('./connection-status.scss');

interface ConnectionStatusProps {
  isConnected: boolean;
  connect(): void;
}

class ConnectionStatus extends React.Component<ConnectionStatusProps> {
  render(): JSX.Element | null {
    if (this.props.isConnected) {
      return null;
    } else {
      return <div className="conn-status">
        <div className="conn-status__text">
          Not connected to any library...
        </div>
        <button className="conn-status__btn" onClick={this.props.connect}>
          Connect to demo library (ensure server is started)
        </button>
      </div>
    }
  }
}

export const CConnectionStatus = connect((state: AppState) => {
  return {
    isConnected: state.conn && state.conn.isConnected
  };
}, (dispatch) => {
  return {
    connect: () => {
      dispatch(doConnect());
    }
  }
})(ConnectionStatus);
