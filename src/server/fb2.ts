import {ExtractedMetadata, MetadataParser} from "./metadata";
import * as xml2js from 'xml2js';
import * as fs from "fs";

function getFirstXMLNode(xml: any, prop: string): any {
  if (xml.$$[prop] != null && xml.$$[prop].length > 0) {
    return xml.$$[prop][0];
  }
  return null;
}

function getXMLNode(xml: any, ...elems: string[]): any {
  let curNode = xml;
  for (let elem of elems) {
    if (curNode == null) {
      return null;
    }
    curNode = getFirstXMLNode(curNode, elem);
  }
  return curNode;
}

function getXMLNodeText(xml: any, def: string, ...elems: string[]): string {
  let value = getXMLNode(xml, ...elems);
  if (value == null) {
    return def;
  } else if (typeof value !== 'string') {
    throw new Error('Node instead of text in XML!');
  } else {
    return value;
  }
}

export class FB2MetadataParser extends MetadataParser {
  async extract(): Promise<ExtractedMetadata> {
    return new Promise<ExtractedMetadata>((resolve, reject) => {
      fs.readFile(this._filename, { encoding: 'utf-8', flag: 'r' }, (err, data) => {
        if (err) {
          reject(err);
        }

        let xmlParser = new xml2js.Parser({
          normalizeTags: true,
          explicitArray: true,
          explicitChildren: true
        });
        xmlParser.parseString(data, (err: Error, result: any) => {
          if (err) {
            reject(err);
          }

          if (result.fictionbook == null) {
            throw new Error('The does not appear to be a valid FB2 document');
          }

          let desc = getXMLNode(result.fictionbook, 'description');
          if (desc == null) {
            throw new Error('No description found in FB2 document');
          }

          let title = getXMLNodeText(desc, '', 'title-info', 'book-title');
          let authorFirst = getXMLNodeText(desc, '', 'title-info', 'author', 'first-name');
          let authorLast = getXMLNodeText(desc, '', 'title-info', 'author', 'last-name');
          let authorMiddle = getXMLNodeText(desc ,'', 'title-info', 'author', 'middle-name');

          resolve({
            title: title,
            author: `${authorLast}, ${authorFirst} ${authorMiddle}`
          });
        });
      });
    });
  }
}
