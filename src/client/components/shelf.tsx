import * as React from "react";
import {Resource} from "../../server/library-db";

export interface ShelfProps {
  resources: Resource[];
}

export class Shelf extends React.Component<ShelfProps> {
  render(): JSX.Element {
    throw new Error("Method not implemented");
  }
}
