import * as React from "react";
import {FullResourceDataRecord, StoreRecord} from "../store/store";
import {connect} from "react-redux";
import {KnownGroupTypes, ObjectRole, PersonRelation} from "../../common/db";

interface DetailsProps {
  activeResource: FullResourceDataRecord;
}

class Details extends React.Component<DetailsProps> {
  render(): JSX.Element {
    if (!this.props.activeResource) {
      return <div>
        No resource selected
      </div>;
    }

    let coverObject = this.props.activeResource.relatedObjects.find(obj => obj.role === ObjectRole.Cover);
    let coverUrl: string = coverObject && coverObject.location ? coverObject.location : '';

    let authors = this.props.activeResource.relatedPersons
            .filter(p => p.relation === PersonRelation.Author)
            .map(p => p.name)
            .join(' & ');

    let tags = this.props.activeResource.relatedGroups
            .filter(g => g.groupType.uuid === KnownGroupTypes.Tag)
            .map(g => g.title)
            .join(', ');

    return <div>
      <div>
        <img src={coverUrl} alt="Cover image" />
      </div>

      <p>{this.props.activeResource.title}</p>
      <p>Authors: {authors}</p>
      <p>Tags: {tags}</p>

      <p>{this.props.activeResource.desc}</p>
    </div>;
  }
}

export const CDetails = connect((state: StoreRecord) => {
  return {
    activeResource: state.activeResource
  };
})(Details);
