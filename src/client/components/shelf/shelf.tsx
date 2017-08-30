import * as React from "react";
import {getShelfResults, loadResource, AppState, selectResource} from "../../store/store";
import {connect} from "react-redux";
import {FullResourceData} from "../../../common/db";
require('./shelf.scss');

interface ShelfProps {
  shelfResults: FullResourceData[]|null;
  isConnected: boolean;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  setActiveResource: (res: FullResourceData) => void;
  getShelfResults: () => void;
}

class Shelf extends React.Component<ShelfProps> {
  selectRow(index: number): void {
    this.props.setActiveIndex(index);
    if (this.props.shelfResults && index >= 0 && index < this.props.shelfResults.length) {
      this.props.setActiveResource(this.props.shelfResults[index]);
    }
  }

  getShelfResults(props: ShelfProps): void {
    if (!props.shelfResults && props.isConnected) {
      this.props.getShelfResults();
    }
  }

  componentWillReceiveProps(nextProps: ShelfProps): void {
    this.getShelfResults(nextProps);
  }

  componentDidMount(): void {
    this.getShelfResults(this.props);
  }

  render(): JSX.Element {
    return <table className="shelf">
      <tbody className="shelf__body">
        {this.props.shelfResults && this.props.shelfResults.map((res: FullResourceData, index) => {
          let className = 'shelf__row' + (index === this.props.activeIndex ? ' shelf__row--active' : '');
          return <tr className={className} key={index} onClick={this.selectRow.bind(this, index)}>
            <td className="shelf__cell">{res.title}</td>
          </tr>
        })}
      </tbody>
    </table>;
  }
}

export const CShelf = connect((state: AppState) => {
  return {
    shelfResults: state.shelf.shelfResults,
    isConnected: state.connection.isConnected,
    activeIndex: state.shelf.activeIndex
  }
}, (dispatch) => {
  return {
    setActiveResource: (res: FullResourceData) => {
      dispatch(loadResource(res.uuid));
    },
    setActiveIndex: (index: number) => {
      dispatch(selectResource(index));
    },
    getShelfResults: () => {
      dispatch(getShelfResults());
    }
  }
})(Shelf);
