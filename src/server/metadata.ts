import {Person, RelatedPerson} from "./library-db";

export interface ExtractedMetadata {
  title: string;
  persons: RelatedPerson[];
}

export abstract class MetadataParser {
  constructor(protected _filename: string) {

  }

  abstract async extract(): Promise<ExtractedMetadata>;

  /** Protected area **/
}
