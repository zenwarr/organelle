import {ExtractedMetadata, MetadataParser} from "./metadata";
import * as libxml from 'libxmljs';
import * as fs from "fs";
import * as tmp from 'tmp';
import {promisify} from "util";
import {PersonRelation, RelatedPerson} from "./library-db";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const FB2_NAMESPACE = 'http://www.gribuser.ru/xml/fictionbook/2.0';
const FB2_NS = {
  fb2: FB2_NAMESPACE
};

function getPersonName(elem: libxml.Element) {
  let authorFirstNode = elem.get('fb2:first-name', FB2_NS);
  let authorMiddleNode = elem.get('fb2:middle-name', FB2_NS);
  let authorLastNode = elem.get('fb2:last-name', FB2_NS);

  let first = authorFirstNode ? authorFirstNode.text().trim() : '';
  let middle = authorMiddleNode ? authorMiddleNode.text().trim() : '';
  let last = authorLastNode ? authorLastNode.text().trim() : '';

  return [last, [first, middle].join(' ').trim()].join(', ').trim();
}

function* personsList(elems: libxml.Node[], relation: PersonRelation): IterableIterator<RelatedPerson> {
  for (let j = 0; j < elems.length; ++j) {
    let authorElem = elems[j] as libxml.Element;
    let author = getPersonName(authorElem);
    if (author) {
      yield {
        name: author,
        relation: relation
      };
    }
  }
}

function innerXMl(node: libxml.Node): string {
  if (node.type() !== 'element') {
    return node.toString().trim();
  } else {
    let elem = node as libxml.Element;
    let parts: string[] = [];
    for (let j = 0; j < elem.childNodes().length; j++) {
      let child = elem.childNodes()[j];
      parts.push(child.toString());
    }
    return parts.join('').trim();
  }
}

function extensionFromType(type: string, def: string): string {
  switch (type.toLowerCase().trim()) {
    case 'image/jpeg':
    case 'image/jpg': {
      return '.jpg'
    }

    case 'image/png':
      return '.png';

    case 'image/bmp':
      return '.bpm';

    default:
      return def;
  }
}

export class FB2MetadataParser extends MetadataParser {
  async extract(): Promise<ExtractedMetadata> {
    let fileContents = await readFile(this._filename, { encoding: 'utf-8' });
    let doc = libxml.parseXml(fileContents);

    let metadata: ExtractedMetadata = {
      title: ''
    };

    let titleInfo = doc.get('/fb2:FictionBook/fb2:description/fb2:title-info', FB2_NS);
    if (titleInfo != null) {
      let titleElem = titleInfo.get('fb2:book-title', FB2_NS);
      if (titleElem != null) {
        metadata.title = titleElem.text();
      }

      metadata.persons = [];
      for (let author of personsList(titleInfo.find('fb2:author', FB2_NS), PersonRelation.Author)) {
        metadata.persons.push(author);
      }

      for (let tr of personsList(titleInfo.find('fb2:translator', FB2_NS), PersonRelation.Translator)) {
        metadata.persons.push(tr);
      }

      let genreNodes = titleInfo.find('fb2:genre', FB2_NS);
      metadata.genres = [];
      for (let j = 0; j < genreNodes.length; ++j) {
        let genreNode = genreNodes[j] as libxml.Element;
        metadata.genres.push(genreNode.text());
      }

      let annotNode = titleInfo.get('fb2:annotation', FB2_NS);
      if (annotNode != null) {
        metadata.desc = innerXMl(annotNode);
      }

      let keywordNode = titleInfo.get('fb2:keywords', FB2_NS);
      if (keywordNode != null) {
        metadata.tags = keywordNode.text().split(/[,;]/);
      }

      metadata.langs = [];
      let langNodes = titleInfo.find('fb2:lang', FB2_NS);
      for (let j = 0; j < langNodes.length; j++) {
        let langNode = langNodes[j] as libxml.Element;
        metadata.langs.push(langNode.text());
      }

      let srcLangNodes = titleInfo.find('fb2:src-lang', FB2_NS);
      for (let j = 0; j < srcLangNodes.length; j++) {
        let srcLangNode = srcLangNodes[j] as libxml.Element;
        metadata.langs.push(srcLangNode.text());
      }

      let coverNode = titleInfo.get('fb2:coverpage/fb2:image', FB2_NS);
      if (coverNode != null) {
        let imageHref = coverNode.attr('href').value();
        if (imageHref) {
          if (imageHref.startsWith('#')) {
            // referring to the local node, we should extract it and decode
            let imageDataNode = doc.get(`//*[@id='${imageHref.slice(1)}']`);
            if (imageDataNode) {
              let ext = extensionFromType(imageDataNode.attr('content-type').value(), '.bmp');
              let filename = tmp.tmpNameSync({ prefix: 'orgl-cover-', postfix: ext });

              let buf = Buffer.from(imageDataNode.text(), 'base64');

              try {
                await writeFile(filename, buf);
                metadata.coverFilename = filename;
              } catch (err) {

              }
            }
          }
        }
      }

      return metadata;
    }

    throw new Error('The file does not have metadata');
  }
}
