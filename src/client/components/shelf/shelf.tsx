import * as React from "react";
import {getShelfResults, loadResource, AppState} from "../../store/store";
import {connect} from "react-redux";
import {FullResourceData} from "../../../common/db";
require('./shelf.scss');

interface ShelfProps {
  shelfResults: FullResourceData[]|null;
  isConnected: boolean;
  setActiveResource: (res: FullResourceData) => void;
  getShelfResults: () => void;
}

interface ShelfState {
  currentIndex: number;
}

class Shelf extends React.Component<ShelfProps, ShelfState> {
  constructor() {
    super();
    this.state = {
      currentIndex: -1
    };
  }

  selectRow(index: number): void {
    this.setState({
      currentIndex: index
    });
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
          let className = 'shelf__row' + (index === this.state.currentIndex ? ' shelf__row--active' : '');
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
    shelfResults: state.shelfResults,
    isConnected: state.conn && state.conn.isConnected
  }
}, (dispatch) => {
  return {
    setActiveResource: (res: FullResourceData) => {
      dispatch(loadResource(res.uuid));
    },
    getShelfResults: () => {
      dispatch(getShelfResults());
    }
  }
})(Shelf);
