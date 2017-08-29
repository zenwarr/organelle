import * as React from "react";
import {loadResource, Store} from "../store/store";
import {connect} from "react-redux";
import {FullResourceData} from "../../common/db";

interface ShelfProps {
  shelfResults: FullResourceData[];
  setActiveResource: (res: FullResourceData) => void;
}

class Shelf extends React.Component<ShelfProps> {
  selectRow(index: number): void {
    this.props.setActiveResource(this.props.shelfResults[index]);
  }

  render(): JSX.Element {
    return <table>
      <tbody>
        {this.props.shelfResults.map((res: FullResourceData, index) => {
          return <tr key={index} onClick={this.selectRow.bind(this, index)}>
            <td>{res.title}</td>
          </tr>
        })}
      </tbody>
    </table>;
  }
}

export const CShelf = connect((state: Store) => {
  return {
    shelfResults: state.shelfResults
  };
}, (dispatch) => {
  return {
    setActiveResource: (res: FullResourceData) => {
      dispatch(loadResource(res.uuid));
    }
  }
})(Shelf);
