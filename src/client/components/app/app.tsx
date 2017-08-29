import * as React from "react";
import {connect} from "react-redux";
import {getShelfResults, Store} from "../../store/store";
import {CConnectionStatus} from "../connection-status/connection-status";
import {CShelf} from "../shelf/shelf";
import {CStatusBar} from "../status/status";
import {CDetails} from "../details/details";

interface AppProps {
  connect(): void;
}

export class App extends React.Component<AppProps> {
  render() {
    return <div>
      <h1>Hello! My name is Organelle!</h1>
      <CConnectionStatus />
      <CShelf />

      <CDetails />

      <button onClick={this.props.connect}>
        Connect to library...
      </button>

      <CStatusBar />
    </div>;
  }
}

export const CApp = connect((state: Store) => {
  return { };
}, (dispatch) => {
  return {
    connect: () => {
      dispatch(getShelfResults());
    }
  }
})(App);
