import * as React from "react";
import {CConnectionStatus} from "./connection-status";
import {CShelf} from "./shelf";
import {CStatusBar} from "./status";
import {getShelfResults, StoreRecord} from "../store/store";
import {connect} from "react-redux";
import {CDetails} from "./details";

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

export const CApp = connect((state: StoreRecord) => {
  return { };
}, (dispatch) => {
  return {
    connect: () => {
      dispatch(getShelfResults());
    }
  }
})(App);
