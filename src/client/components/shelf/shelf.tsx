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
  getShelfResults: () => void;
}

class Shelf extends React.Component<ShelfProps> {
  selectRow(index: number): void {
    this.props.setActiveIndex(index);
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

  onKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
    switch (e.key) {
      case 'ArrowUp':
        if (this.props.activeIndex > 0) {
          this.selectRow(this.props.activeIndex - 1);
        }
        break;

      case 'ArrowDown':
        if (this.props.shelfResults && this.props.activeIndex + 1 < this.props.shelfResults.length) {
          this.selectRow(this.props.activeIndex + 1);
        }
        break;
    }
  }

  render(): JSX.Element {
    return <div className="shelf" onKeyDown={this.onKeyDown.bind(this)} tabIndex={0}>
      <table className="shelf__table">
        <tbody className="shelf__body">
        {this.props.shelfResults && this.props.shelfResults.map((res: FullResourceData, index) => {
          let className = 'shelf__row' + (index === this.props.activeIndex ? ' shelf__row--active' : '');
          return <tr className={className} key={index} onClick={this.selectRow.bind(this, index)}>
            <td className="shelf__cell">{res.title}</td>
          </tr>
        })}
        </tbody>
      </table>
    </div>;
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
    setActiveIndex: (index: number) => {
      dispatch(selectResource(index));
    },
    getShelfResults: () => {
      dispatch(getShelfResults());
    }
  }
})(Shelf);
