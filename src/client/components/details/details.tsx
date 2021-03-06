import * as React from "react";
import {connect} from "react-redux";
import {
  KnownGroupTypes, ObjectRole, FullResourceData, PersonRelation, RelatedObject,
  ResolvedRelatedObject
} from "../../../common/db";
import {AppState} from "../../store/store";
import {loadResource, unloadResource} from "../../store/actions";

interface DetailsProps {
  activeIndex: number;
  activeResource: FullResourceData|null;
  shelfResults: FullResourceData[]|null;
  loadResource: (resource: FullResourceData) => void;
  unloadResource: () => void;
}

class Details extends React.Component<DetailsProps> {
  loadActiveResource(props: DetailsProps): void {
    if (props.activeIndex < 0 || (props.shelfResults && props.activeIndex >= props.shelfResults.length)) {
      this.props.unloadResource();
    } else if (props.shelfResults) {
      if (!props.activeResource || props.shelfResults[props.activeIndex].uuid !== props.activeResource.uuid) {
        this.props.loadResource(props.shelfResults[props.activeIndex]);
      }
    }
  }

  componentWillReceiveProps(newProps: DetailsProps) {
    this.loadActiveResource(newProps);
  }

  componentDidMount(): void {
    this.loadActiveResource(this.props);
  }

  render(): JSX.Element {
    if (!this.props.activeResource) {
      return <div>
        No resource selected
      </div>;
    }

    let res = this.props.activeResource;

    let coverObject = res.relatedObjects.find(obj => obj.role === ObjectRole.Cover);
    let coverUrl: string = coverObject && coverObject.location ? coverObject.location : '';

    let authors = res.relatedPersons
            .filter(p => p.relation === PersonRelation.Author)
            .map(p => p.name)
            .join(' & ');

    let tags = res.relatedGroups
            .filter(g => g.groupType.uuid === KnownGroupTypes.Tag)
            .map(g => g.title)
            .join(', ');

    return <div>
      <div>
        <img src={coverUrl} alt="Cover image" />
      </div>

      <p>{res.title}</p>
      <p>Authors: {authors}</p>
      <p>Tags: {tags}</p>

      <p>{res.desc}</p>

      {this.renderObjects(res.relatedObjects.filter(obj => obj.role === ObjectRole.Format))}
    </div>;
  }

  protected renderObjects(objects: ResolvedRelatedObject[]): JSX.Element|null {
    if (!objects.length) {
      return null;
    } else {
      return <div>
        {objects.map(obj => {
          return <div className={"details__format-btn-cont"}>
            <a href={obj.location || "#"}>{obj.tag || '[Unknown format]'}</a>
          </div>
        })}
      </div>
    }
  }
}

export const CDetails = connect((state: AppState) => {
  return {
    activeResource: state.shelf.activeResource,
    activeIndex: state.shelf.activeIndex,
    shelfResults: state.shelf.shelfResults
  };
}, (dispatch) => {
  return {
    loadResource: (res: FullResourceData) => {
      dispatch(loadResource(res.uuid));
    },
    unloadResource: () => {
      dispatch(unloadResource());
    }
  }
})(Details);
