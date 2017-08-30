import * as React from "react";
import {connect} from "react-redux";
import {AppState} from "../../store/store";
import {CConnectionStatus} from "../connection-status/connection-status";
import {CShelf} from "../shelf/shelf";
import {CStatusBar} from "../status/status";
import {CDetails} from "../details/details";
require('./app.scss');

export class App extends React.Component {
  render() {
    return <div className="app">
      <div className="app__connection-status">
        <CConnectionStatus />
      </div>

      <div className="app__main">
        <div className="app__shelf">
          <CShelf />
        </div>

        <div className="app__details">
          <CDetails />
        </div>
      </div>

      <div className="app__statusbar">
        <CStatusBar />
      </div>
    </div>;
  }
}

export const CApp = connect((state: AppState) => {
  return { };
})(App);
