// Type definitions for Libxmljs v0.14.2
// Project: https://github.com/polotek/libxmljs
// Definitions by: François de Campredon <https://github.com/fdecampredon>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node"/>

declare module "libxmljs" {
  import events = require('events');

  export function parseXml(source: string): Document;
  export function parseHtml(source: string): HTMLDocument;
  export function parseXmlString(source: string): Document;
  export function parseHtmlString(source: string): HTMLDocument;
  export function parseHtmlFragment(source: string): HTMLDocument;
  export function memoryUsage(): number;
  export function nodeCount(): number;
  export const version: string;
  export const libxml_version: string;
  export const libxml_parser_version: string;
  export const libxml_debug_enabled: boolean;

  export enum NodeType {
    Comment = 'comment',
    Element = 'element',
    Text = 'text',
    Attribute = 'attribute',
    Document = 'document'
  }

  export enum FormatTypeOption {
    Xml = 'xml',
    Html = 'html',
    Xhtml = 'xhtml'
  }

  export interface DTD {
    name: string;
    externalId?: string;
    systemId?: string;
  }

  export interface Document {
    child(idx: number): Element | null;
    childNodes(): Element[];
    errors: SyntaxError[];
    encoding(): string;
    encoding(enc: string): Document;
    find(xpath: string, ns_uri?: string): Element[];
    find(xpath: string, namespaces: { [ns: string]: string }): Element[];
    get(xpath: string, ns_uri?: string): Element | null;
    get(xpath: string, namespaces: { [ns: string]: string }): Element | null;
    node(name: string, content?: string): Element;
    root(): Element | null;
    root(node: Element): Element;
    toString(formatting: boolean): string;
    type(): NodeType;
    validate(xsdDoc: Document): boolean;
    rngValidate(rngDoc: Document): boolean;
    validationErrors: SyntaxError[];
    version(): string;
    getDtd(): DTD | null;
    setDtd(name: string, externalId?: string, systemId?: string): void;
    namespaces(): Namespace[];
  }

  export interface DocumentConstructor {
    (version?: number, encoding?: string): Document;
  }

  export const Document: DocumentConstructor;

  export interface Node {
    doc(): Document;
    parent(): Node | XMLDocument | null;
    prevSibling(): Node | null;
    nextSibling(): Node | null;
    line(): number;
    type(): NodeType;
    remove(): Node;
    clone(): Node;
    toString(format?: boolean): string;
    toString(options: {
      declaration?: boolean;
      format?: boolean;
      selfCloseEmpty?: boolean;
      whitespace?: boolean;
      type: FormatTypeOption;
    }): string;
  }

  export interface Element extends Node {
    node(name: string): Element;
    node(name: string, content: string): Element;
    name(): string;
    name(newName: string): void;
    text(): string;
    text(newText: string): void;
    attr(name: string): Attribute;
    attr(attr: Attribute): Element;
    attr(attrObject: { [key: string]: string; }): Element;
    attrs(): Attribute[];
    parent(): Element | XMLDocument | null;
    child(idx: number): Element | null;
    childNodes(): Element[];
    addChild(child: Element): Element;
    nextSibling(): Element | null;
    nextElement(): Element | null;
    addNextSibling(siblingNode: Element): Element;
    prevSibling(): Element | null;
    prevElement(): Element | null;
    addPrevSibling(siblingNode: Element): Element;
    find(xpath: string): Node[];
    find(xpath: string, ns_uri: string): Node[];
    find(xpath: string, namespaces: { [key: string]: string; }): Node[];
    get(xpath: string): Element | null;
    get(xpath: string, ns_uri: string): Element | null;
    get(xpath: string, ns_uri: { [key: string]: string; }): Element | null;
    defineNamespace(href: string): Namespace;
    defineNamespace(prefix: string, href: string): Namespace;
    namespace(): Namespace | null;
    namespace(ns: Namespace): Element;
    namespace(href: string): Element;
    namespace(prefix: string, href: string): Element;
    namespaces(local?: boolean): Namespace[];
    remove(): Element;
    clone(): Element;
    path(): string;
    cdata(content: string): Element;
  }

  export interface ElementConstructor {
    (doc: Document, name: string, content?: string): Element;
  }

  export const Element: ElementConstructor;

  export interface Attribute extends Node {
    name(): string;
    value(): string;
    value(content: string): Attribute;
    remove(): Attribute;
    clone(): Attribute;
  }

  export interface Comment extends Node {
    text(): string;
    text(content: string): Comment;
  }

  export interface CommentConstructor {
    (doc: Document, content: string): Comment;
  }

  export const Comment: CommentConstructor;

  export interface Namespace {
    href(): string;
    prefix(): string;
  }

  export class SaxParser extends events.EventEmitter {
    parseString(source: string): boolean;
  }


  export class SaxPushParser extends events.EventEmitter {
    push(source: string): boolean;
  }

  export interface SyntaxError {
    domain?: number;
    code?: number;
    message?: string;
    level?: number;
    file?: string;
    column?: number;
    line?: number;
    int1?: number;
    str1: string;
    str2: string;
    str3: string;
  }

}
