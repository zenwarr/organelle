export interface ExtractedMetadata {
  author: string;
  title: string;
}

export abstract class MetadataParser {
  constructor(protected _filename: string) {

  }

  abstract async extract(): Promise<ExtractedMetadata>;

  /** Protected area **/
}
