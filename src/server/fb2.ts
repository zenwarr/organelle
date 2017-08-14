import {ExtractedMetadata, MetadataParser} from "./metadata";
import * as libxml from 'libxmljs';
import * as fs from "fs";
import {promisify} from "util";
import {PersonRelation, RelatedPerson} from "./library-db";

const readFile = promisify(fs.readFile);

const FB2_NAMESPACE = 'http://www.gribuser.ru/xml/fictionbook/2.0';
const FB2_NS = {
  fb2: FB2_NAMESPACE
};

export class FB2MetadataParser extends MetadataParser {
  async extract(): Promise<ExtractedMetadata> {
    let fileContents = await readFile(this._filename, { encoding: 'utf-8' });
    let doc = libxml.parseXml(fileContents);

    let titleInfo = doc.get('/fb2:FictionBook/fb2:description/fb2:title-info', FB2_NS);
    if (titleInfo != null) {
      let title: string = '';
      let titleElem = titleInfo.get('fb2:book-title', FB2_NS);
      if (titleElem != null) {
        title = titleElem.text();
      }

      let persons: RelatedPerson[] = [];
      let authorNodes = titleInfo.find('fb2:author', FB2_NS);
      for (let j = 0; j < authorNodes.length; ++j) {
        let authorElem = authorNodes[j] as libxml.Element;
        let authorFirstNode = authorElem.get('fb2:first-name', FB2_NS);
        let authorMiddleNode = authorElem.get('fb2:middle-name', FB2_NS);
        let authorLastNode = authorElem.get('fb2:last-name', FB2_NS);

        let first = authorFirstNode ? authorFirstNode.text().trim() : '';
        let middle = authorMiddleNode ? authorMiddleNode.text().trim() : '';
        let last = authorLastNode ? authorLastNode.text().trim() : '';

        let author = [last, [first, middle].join(' ').trim()].join(', ').trim();
        if (author) {
          persons.push({
            name: author,
            relation: PersonRelation.Author
          });
        }
      }

      return {
        title: title,
        persons: persons
      };
    }

    throw new Error('The file does not have metadata');
  }
}
