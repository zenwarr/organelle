import * as React from "react";
import {connect} from "react-redux";
import {KnownGroupTypes, ObjectRole, PersonRelation, FullResourceData} from "../../../common/db";
import {Store} from "../../store/store";

interface DetailsProps {
  activeResource: FullResourceData;
}

class Details extends React.Component<DetailsProps> {
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
            .filter(p => (p.relation as any) === 'author')
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
    </div>;
  }
}

export const CDetails = connect((state: Store) => {
  return {
    activeResource: state.activeResource
  };
})(Details);
