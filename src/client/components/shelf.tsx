import * as React from "react";
import {activateResource, FullResourceDataRecord, StoreRecord} from "../store/store";
import * as Immutable from 'immutable';
import {connect} from "react-redux";

interface ShelfProps {
  shelfResults: Immutable.List<FullResourceDataRecord>;
  setActiveResource: (res: FullResourceDataRecord) => void;
}

class Shelf extends React.Component<ShelfProps> {
  selectRow(index: number): void {
    console.log(this.props.shelfResults);
    this.props.setActiveResource(this.props.shelfResults.get(index));
  }

  render(): JSX.Element {
    return <table>
      <tbody>
        {this.props.shelfResults.map((res: FullResourceDataRecord, index) => {
          return <tr key={index} onClick={this.selectRow.bind(this, index)}>
            <td>{res.title}</td>
          </tr>
        })}
      </tbody>
    </table>;
  }
}

export const CShelf = connect((state: StoreRecord) => {
  return {
    shelfResults: state.shelfResults
  };
}, (dispatch) => {
  return {
    setActiveResource: (res: FullResourceDataRecord) => {
      dispatch(activateResource(res));
    }
  }
})(Shelf);
