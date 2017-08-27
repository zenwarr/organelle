import * as React from "react";
import {ConnectionStatusConnected} from "./connection-status";

export class App extends React.Component {
  render() {
    return <div>
      <h1>Hello! My name is Organelle!</h1>
      <ConnectionStatusConnected />
    </div>;
  }
}
