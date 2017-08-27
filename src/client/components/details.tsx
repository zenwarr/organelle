import * as React from "react";
import {
  GroupType,
  KnownGroupTypes,
  ObjectRole, PersonRelation, RelatedGroup, RelatedPerson, ResolvedRelatedObject, Resource
} from "../../server/library-db";

export interface DetailsProps {
  resource: Resource;
  relatedPersons: RelatedPerson[];
  relatedGroups: RelatedGroup[];
  relatedObjects: ResolvedRelatedObject[];
}

export class Details extends React.Component<DetailsProps> {
  render(): JSX.Element {
    let coverObject = this.props.relatedObjects.find(obj => obj.role === ObjectRole.Cover);
    let coverUrl: string = coverObject ? coverObject.location : '';

    let authors = this.props.relatedPersons
            .filter(p => p.relation === PersonRelation.Author)
            .map(p => p.name)
            .join(' & ');

    let tags = this.props.relatedGroups
            .filter(g => (g.groupType as GroupType).uuid === KnownGroupTypes.Tag)
            .map(g => g.title)
            .join(', ');

    return <div>
      <div>
        <img src={coverUrl} alt="Cover image" />
      </div>

      <p>{this.props.resource.title}</p>
      <p>Authors: {authors}</p>
      <p>Tags: {tags}</p>

      <p>{this.props.resource.desc}</p>
    </div>;
  }
}
