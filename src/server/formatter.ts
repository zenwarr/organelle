/**
 * ## Intro
 *
 * The template language is required to format file names or any other required values depending on a set of some values.
 * The language itself is not complicated, and in most aspects is similar to many other template languages.
 * Input consist of text and blocks surrounded by curly braces.
 * Inside these brackets you can refer to variables or call functions.
 * When template is evaluated, these blocks are replaced with resolved values.
 * The simplest example of a template is a variable name written in curly braces.
 * Such block will be replaced with computed value of the variable you've written.
 * For example:
 *
 * ```
 * /home/user/books/{author} - {title}.pdf
 * ```
 *
 * after evaluation can become:
 *
 * ```
 * /home/user/books/J. R. R. Tolkien - Silmarillion.pdf
 * ```
 *
 * There are some more advanced features templates can offer.
 *
 * ## Filters
 *
 * You can process any variable with a set of filters.
 * `{ title | lowercase }` — converts book's title to lowercase.
 * You can add as many filters as you want, separating them with | character.
 * Whitespaces do not matter.
 *
 * ```
 * {author|lowercase|trim}
 * ```
 *
 * Filters are applied in the order they are listed in a block, from the leftmost to the rightmost.
 * Each filter is a mere function and can receive other arguments that you can list in round brackets after function name.
 * For example: `{ series_index | pad_left(3, '0') }` will be evaluated as `007` if series_index is 7.
 * Here you process series_index with a filter `pad_left` which is a function getting exactly three arguments.
 * This function gets a string and, if the string is shorter than some required length, pads it with some character from the left for it to have minimum length.
 * First argument is the resolved value of `series_index`.
 * Second one is minimal length of string we want to get.
 * Third one is a string which be used to pad value if it is shorted than required.
 * Each filter gets a result of previous filter in chain as its first argument.
 * If filter is the first one in the chain (right after the variable, as pad_left in the example above) it gets resolved value of the variable instead.
 * A very first value in a block (in most cases, the value of the variable you write right after opening a block) is called a head value of a block.
 *
 * ## Strings
 *
 * Strings that you pass to functions must be wrapped in single or double quotes.
 * Inside strings, you can use a limited set of escape sequences to mention special characters.
 * For example, if you need to include a single quote inside your string, you cannot do it directly, as it will close string literal instead.
 * You should prepend this quote with backslash character as in the following example:
 *
 * ```
 * { title | wrap('\'@\'') } — will wrap author's name in single quotes.
 * ```
 *
 * Backslash itself also should be escaped (write \\ when you want a string with a backslash).
 *
 * Only \\ \' \" \n \r \t \b sequences can be used.
 * Any other escape sequence is not supported and will trigger an error while parsing the template.
 *
 * ## Numbers
 *
 * You can use integer numbers too.
 * No floating-point numbers are supported.
 * Although a function can get a string with floating number and parse it to use this number.
 * Numbers and strings are interchangeable.
 * You can use a number instead of a string and vise versa.
 * You can wrap a number in quotes where function expects a number, and write your string without quotes if it represents a number.
 * Everything will work fine.
 * We've used `pad_left` function as a filter before, and have wrote it is this way:
 *
 * ```
 * { series_index | pad_left(3, '0') }
 * ```
 *
 * But you could write it in this way too:
 *
 * ```
 * { series_index | pad_left(3, 0) }
 * ```
 *
 * There will be no error.
 * Template processor even internally converts numbers to strings before passing them to functions.
 * A function should parse a string if it wants a number and use the parsed value if required.
 *
 * ## Nested calls
 *
 * You can use a result of another function as an argument.
 * Example:
 *
 * ```
 * { author | func(func2(a), b) }
 * ```
 *
 * ## Identifiers and specifiers
 *
 * Variables and functions names are identifiers.
 * An identifier can consist of latin alphabetic characters, digits and some other characters: _ . @ #
 * Only letter or underscore can be the first character of an identifier.
 * The hash character (#) has special meaning for variable names.
 * It should not be used in function names, but this rule is not enforced.
 * Hash divides an identifier into two parts: one before the hash is actual name of a variable, one after the hash is called specifier.
 * An specifier modifies the process of resolving a variable.
 * How specifier is interpreted depends on a resolver.
 * For example, a specifier can be used to access a specified element of an array.
 * `{ tag#2 }` will be resolved to second element of the array of tags.
 * Different resolvers can offer another meanings for specifiers.
 *
 * ## Optional blocks
 *
 * There can be a question mark in the beginning of a block.
 * It means that if the first resolved value of the block is an empty string, resolving process should stop and do not apply any other filters to this empty string.
 * It can be useful, for example, when you want some value to be surrounded with some text, but only if the value exists.
 * Using such code: `{var|wrap('[@]')}` produces two brackets without any text between them if 'var' is resolved to an empty string.
 * But using the following code: `{?var|wrap('[@]')}` is this case produces nothing and will be evaluated to an empty string itself when 'var' is empty.
 *
 * ## Function calls
 *
 * When function is called without arguments, you can omit braces.
 * But you can also write it, it changes nothing.
 * For example, two following examples are totally equivalent: `{var|lowercase}` and `{var|lowercase()}`
 *
 * ## Variable resolving
 *
 * Variables are resolved to its values by resolvers.
 * Resolver is an internal object and you do not need to know much about it if you only want to write templates.
 * See API documentation to get more details on resolvers.
 * A resolver can either resolve a variable or not.
 * A resolver fails to resolve a variable, for example, if it knows nothing about it.
 * In this case variable is considered to be an empty string.
 * For example, if there is no variable named `gopher`, the following template:
 *
 * ```
 * Look, here is a gopher: {gopher}. Did you see it?
 * ```
 *
 * will be evaluated to the following string:
 *
 * ```
 * Look, here is a gopher: . Did you see it?
 * ```
 *
 * Yeah, you didn't see a gopher.
 * Me too.
 * But it exists.
 * It was evaluated to an empty string.
 * Such behavior can be helpful in most cases, but you can set a `strictVarResolve` flag on TemplateProcessor (see API documentation on details) and any variable that cannot be resolved will result in an error.
 * So you will not be able to evaluate this template at all.
 *
 * When you write an identifier without braces, it can be interpreter either as a variable or a function call without arguments.
 * It is unwanted situation when variable name collates with a name of a function, but you should know that variable will be tried first.
 * If all resolves will fail to resolve a variable, it will be considered to be a function call.
 * If there is no function too, the identifier will not be resolved and will result in either considering it to be an empty string or throwing an error (if `strictVarResolve` flag is set).
 *
 * ## Function result as the first variable
 *
 * You can use a function instead of a plain variable to get a head value of a block.
 * Just write it:
 *
 * ```
 * { generate_some_value(123) | lowercase }
 * ```
 */

export type VarResolver = (name: string, specifier: string|null) => string|null;
export type FuncResolver = (value: string|null, ...args: any[]) => string|null;

function resolveFromObject(obj: any, name: string, specifier: string|null): string|null {
  let keys = Object.keys(obj);
  let lcKeys = keys.map(key => key.toLowerCase());
  let lcKeysIndex = lcKeys.indexOf(name);

  if (lcKeysIndex >= 0) {
    let result = obj[keys[lcKeysIndex]];
    if (specifier != null && specifier.length > 0) {
      return result == null ? null : resolveFromObject(result, specifier, null);
    } else {
      return result == null ? '' : '' + result;
    }
  } else {
    return null;
  }
}

export function createPropsResolver(obj: any): VarResolver {
  return resolveFromObject.bind(null, obj);
}

const LOREM: string[] = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ');

const DEFAULT_FUNCTIONS: { [name: string]: FuncResolver } = {
  lowercase: input => {
    return input == null ? null : input.toLowerCase();
  },
  uppercase: input => {
    return input == null ? null : input.toUpperCase();
  },
  trim: input => {
    return input == null ? null : input.trim();
  },
  def: (input: string|null, ...args: any[]): string => {
    if (args.length < 1) {
      throw new FilterArgumentsError(1);
    }
    return input == null || input.length === 0 ? '' + args[0] : input;
  },
  add: (input: string|null, ...args: any[]): string => {
    if (args.length < 2) {
      throw new FilterArgumentsError(2);
    }

    let a = parseInt(args[0]), b = parseInt(args[1]);
    if (isNaN(a)) {
      throw new Error('Argument 1 is invalid: should be a number');
    }
    if (isNaN(b)) {
      throw new Error('Argument 2 is invalid: should be a number');
    }

    return '' + (a + b);
  },
  wrap: (input: string|null, ...args: any[]): string => {
    if (input == null) {
      throw new Error('The function can be used only as a filter');
    }

    if (args.length < 1) {
      throw new FilterArgumentsError(1);
    }

    let format = args[0];
    if (format == null) {
      throw new Error('Argument 1 is invalid: a value expected');
    }

    if (format.indexOf('@') < 0) {
      throw new Error('You must provide a format string with @ denoting the position of text to wrap');
    }

    return format.replace('@', input);
  },
  _lorem: (input: string|null, ...args: any[]): string => {
    if (args.length < 1) {
      throw new FilterArgumentsError(1);
    }
    let wordCount = parseInt(args[0]);
    if (isNaN(wordCount)) {
      throw new Error('Argument 1 is invalid: should be a number');
    }

    if (wordCount > LOREM.length) {
      wordCount = LOREM.length;
    }

    return LOREM.slice(0, wordCount).join(' ');
  }
};

class FilterArgumentsError extends Error {
  constructor(public reqArgsCount: number) {
    super();
  }
}

export class TemplateProcessor {
  constructor(varResolver: VarResolver, strictVarResolve: boolean = false) {
    this._strictVarResolve = strictVarResolve;
    this.addVarResolver(varResolver);
  }

  addVarResolver(resolver: VarResolver): void {
    if (resolver == null) {
      throw new Error('Cannot add a variable resolver: invalid resolver');
    }
    this._varResolvers.push(resolver);
  }

  addFuncResolver(name: string, resolver: FuncResolver): void {
    name = name.toLowerCase();
    if (!isValidName(name)) {
      throw new Error(`Cannot add a new function named ${name}: this is an invalid name for a function`);
    }
    if (this._funcResolvers.name != null) {
      throw new Error(`Cannot add a new function named ${name}: function already registered`);
    }
    if (resolver == null) {
      throw new Error(`Cannot add a new function named ${name}: invalid resolver`);
    }
    this._funcResolvers[name] = resolver;
  }

  process(input: string): string {
    let nodes = (new AstCreator(tokenize(input))).create();
    if (nodes.length === 0) {
      return '';
    }

    let parts: string[] = [];

    for (let node of nodes) {
      if (node.type === AstNodeType.RawText) {
        this._badAst(node.value != null);
        parts.push(node.value);
      } else if (node.type === AstNodeType.Block) {
        let blockNode = node as BlockAstNode;
        // resolve block
        if (node.children == null || node.children.length === 0) {
          this._badAst();
        } else {
          let curValue: string|null = null;
          for (let j = 0; j < node.children.length; ++j) {
            let childNode = node.children[j];
            curValue = this._resolveExpr(curValue, childNode);
            if (j === 0 && blockNode.optional) {
              curValue = '';
              break;
            }
          }
          if (curValue == null) {
            curValue = '';
          }
          parts.push(curValue);
        }
      }
    }

    return parts.join('');
  }

  resolveVar(name: string): string|null {
    name = name.toLowerCase().trim();

    let realName: string, specifier: string|null;

    let specIndex = name.indexOf('#');
    if (specIndex >= 0) {
      realName = name.slice(0, specIndex);
      specifier = name.slice(specIndex + 1); // specifier can be empty, it is valid
    } else {
      realName = name;
      specifier = null;
    }

    for (let resolver of this._varResolvers) {
      let resolved = resolver(realName, specifier);
      if (resolved != null) {
        return resolved;
      }
    }
    return null;
  }

  resolveFunc(name: string, input: string|null, ...args: any[]): string|null {
    let resolver = this.getFuncResolver(name);
    return resolver == null ? null : resolver(input, ...args);
  }

  getFuncResolver(name: string): FuncResolver|null {
    name = name.toLowerCase().trim();
    if (this._funcResolvers[name] != null) {
      return this._funcResolvers[name];
    } else if (DEFAULT_FUNCTIONS[name] != null) {
      return DEFAULT_FUNCTIONS[name];
    }
    return null;
  }

  get strictVarResolve(): boolean { return this._strictVarResolve; }
  set strictVarResolve(value: boolean) { this._strictVarResolve = value; }

  /** Protected area **/

  protected _varResolvers: VarResolver[] = [];
  protected _funcResolvers: { [name: string]: FuncResolver } = {};
  protected _strictVarResolve: boolean;

  protected _badAst(is: boolean = false): void {
    if (!is) {
      throw new Error('Failed to resolve template: invalid ast tree');
    }
  }

  protected _resolveExpr(curValue: string|null, node: AstNode): string|null {
    if (node == null) {
      throw new Error('Failed to resolve template: invalid ast tree');
    }

    if (curValue != null || node.type === AstNodeType.Function) {
      // if curValue != null, the expression cannot be a variable, it must be a function
      // trying to find a function
      let funcResolver = this.getFuncResolver(node.value);
      if (funcResolver == null) {
        throw new Error(`Failed to resolve template: function ${node.value} not found`);
      }

      // build argument list
      let argList: (string|null)[] = [];
      if (node.children != null && node.children.length > 0) {
        for (let j = 0; j < node.children.length; ++j) {
          argList.push(this._resolveExpr(null, node.children[j]));
        }
      }

      return funcResolver(curValue, ...argList);
    } else if (node.type === AstNodeType.String || node.type === AstNodeType.Number) {
      return node.value;
    } else if (node.type === AstNodeType.FunctionOrVariable) {
      // it can be either a variable or a function. In either case, it has no arguments.
      // try variables first
      let curValue = this.resolveVar(node.value);
      if (curValue == null) {
        curValue = this.resolveFunc(node.value, null);
      }
      if (curValue == null && this.strictVarResolve) {
        throw new Error(`Cannot resolve variable named "${node.value}" (strict mode set)`);
      }
      return curValue;
    } else {
      throw new Error('Failed to resolve template: invalid ast tree');
    }
  }
}

function isValidName(name: string): boolean {
  if (name.length === 0 || !(isAlphaCode(name.charCodeAt(0)) && name.charCodeAt(0) === CHAR_UNDERSCORE)) {
    return false;
  }
  for (let j = 1; j < name.length; ++j) {
    let ch = name.charCodeAt(j);
    if (!(isAlphaCode(ch) || isDigitCode(ch) || ch === CHAR_UNDERSCORE)) {
      return false;
    }
  }
  return true;
}

export enum TokenType {
  RawText,
  CurlyOpen,
  CurlyClose,
  BracketOpen,
  BracketClose,
  Filter,
  Comma,
  Ident,
  Question,
  Gt,
  String,
  Number
}

interface Token {
  value: string;
  begin: number;
  type: TokenType;
}

const CHAR_CURLY_OPEN = '{'.charCodeAt(0);
const CHAR_CURLY_CLOSE = '}'.charCodeAt(0);
const CHAR_FILTER = '|'.charCodeAt(0);
const CHAR_COMMA = ','.charCodeAt(0);
const CHAR_BRACKET_OPEN = '('.charCodeAt(0);
const CHAR_BRACKET_CLOSE = ')'.charCodeAt(0);
const CHAR_UNDERSCORE = '_'.charCodeAt(0);
const CHAR_QUESTION = '?'.charCodeAt(0);
const CHAR_GT = '>'.charCodeAt(0);
const CHAR_SINGLE_QUOTE = '\''.charCodeAt(0);
const CHAR_DOUBLE_QUOTE = '"'.charCodeAt(0);
const CHAR_BACKSLASH = '\\'.charCodeAt(0);
const WHITESPACE_CODES: number[] = ' \t\n\r\v\f\u00A0\u2028\u2029'.split('').map(x => x.charCodeAt(0));

function isWhitespaceCode(ch: number): boolean {
  return WHITESPACE_CODES.indexOf(ch) >= 0;
}

function isAlphaCode(ch: number): boolean {
  return (ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0)) || (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0));
}

function isDigitCode(ch: number): boolean {
  return ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0);
}

const NAME_SPECIAL_CHARS = '_#.';
function isNameCode(ch: number): boolean {
  return (ch >= 'a'.charCodeAt(0) && ch <= 'z'.charCodeAt(0)) || (ch >= 'A'.charCodeAt(0) && ch <= 'Z'.charCodeAt(0)) ||
      (ch >= '0'.charCodeAt(0) && ch <= '9'.charCodeAt(0)) || NAME_SPECIAL_CHARS.indexOf(String.fromCharCode(ch)) >= 0;
}

const SUPPORTED_ESCAPE_SEQUENCES = '\\' + "'" + '"nrtb';
const SUPPORTED_ESCAPE_REPLACEMENT = [ '\\', "'", '"', '\n', '\r', '\t', '\b' ];

export function replaceEscapeSequences(input: string): string {
  let parts: string[] = [];
  let prevHit: number = 0;

  for (let j = 0; j < input.length; ++j) {
    if (input.charCodeAt(j) === CHAR_BACKSLASH) {
      // ready!
      let ch = input.charAt(j + 1);
      if (ch.length === 0) {
        throw new Error(`Unexpected end of input: escape sequence interrupted`);
      }
      let esIndex = SUPPORTED_ESCAPE_SEQUENCES.indexOf(ch);
      if (esIndex >= 0) {
        parts.push(input.slice(prevHit, j));
        parts.push(SUPPORTED_ESCAPE_REPLACEMENT[esIndex]);
        prevHit = j + 2;
        ++j;
      } else {
        throw new Error(`Unsupported escape sequence: \\${input.charAt(j + 1)}`);
      }
    }
  }

  if (prevHit > 0) {
    parts.push(input.slice(prevHit));
  }

  return parts.length > 0 ? parts.join('') : input;
}

export function tokenize(input: string): Token[] {
  let tail = 0, head = -1;

  function eat(): void {
    tail = head;
  }

  function nextChar(): number|null {
    if (head + 1 >= input.length) {
      if (input.length > 0) {
        head = input.length;
      }
      return null;
    } else {
      return input.charCodeAt(++head);
    }
  }

  function pushToken(type: TokenType, back: number = 0): void {
    tokenList.push({
      value: input.slice(tail, head + 1 - back),
      begin: tail,
      type: type
    });
  }

  let tokenList: Token[] = [];

  let ch = nextChar();
  let insideVar = false;
  while (true) {
    if (ch == null) {
      // end of the string
      if (head != tail && head >= 0) {
        pushToken(TokenType.RawText, 1);
      }
      break;
    } else if (ch === CHAR_CURLY_OPEN) {
      // flush raw text before the opening curly bracket
      if (head != tail) {
        pushToken(TokenType.RawText, 1);
        eat();
      }

      pushToken(TokenType.CurlyOpen);
      insideVar = true;
      ch = nextChar();
      eat();
    } else if (insideVar) {
      if (ch === CHAR_CURLY_CLOSE) {
        pushToken(TokenType.CurlyClose);
        insideVar = false;
        ch = nextChar();
        eat();
      } else if (ch === CHAR_FILTER) {
        pushToken(TokenType.Filter);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_FILTER) {
        pushToken(TokenType.Filter);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_BRACKET_OPEN) {
        pushToken(TokenType.BracketOpen);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_BRACKET_CLOSE) {
        pushToken(TokenType.BracketClose);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_COMMA) {
        pushToken(TokenType.Comma);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_QUESTION) {
        pushToken(TokenType.Question);
        ch = nextChar();
        eat();
      } else if (ch === CHAR_GT) {
        pushToken(TokenType.Gt);
        ch = nextChar();
        eat();
      } else if (isWhitespaceCode(ch)) {
        do {
          ch = nextChar();
        } while (ch != null && isWhitespaceCode(ch));
        eat();
      } else if (isAlphaCode(ch) || ch === CHAR_UNDERSCORE) {
        do {
          ch = nextChar();
        } while (ch != null && (isNameCode(ch)));
        pushToken(TokenType.Ident, 1);
        eat();
      } else if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
        // quoted string
        let quoteCode = ch;
        while (true) {
          ch = nextChar();

          if (ch == null) {
            throw new Error('Unexpected end of input, quoted string is unclosed');
          } else if (ch === quoteCode) {
            break;
          } else if (ch === '\\'.charCodeAt(0)) {
            // begin escape sequence, only single-char sequences are supported
            ch = nextChar();
            if (ch == null) {
              throw new Error('Unexpected end of input, quoted string is unclosed');
            }
          }
        }

        tokenList.push({
          value: replaceEscapeSequences(input.slice(tail + 1, head)),
          begin: tail,
          type: TokenType.String
        });

        ch = nextChar();
        eat();
      } else if (isDigitCode(ch)) {
        do {
          ch = nextChar();
        } while (ch != null && isDigitCode(ch));

        if (ch != null && (isAlphaCode(ch) || isNameCode(ch))) {
          // this is not a number, this is an incorrect identifier!!!
          throw new Error(`Identifier cannot start with a number: ${input.slice(tail, head + 1)}`);
        }

        pushToken(TokenType.Number, 1);
        eat();
      } else {
        throw new Error(`Unexpected char: ${String.fromCharCode(ch)}`);
      }
    } else {
      ch = nextChar();
    }
  }

  return tokenList;
}

export enum AstNodeType {
  RawText,
  Block,
  FunctionOrVariable,
  Function,
  String,
  Number
}

export interface AstNode {
  type: AstNodeType;
  value?: any;
  children?: AstNode[];
}

export interface BlockAstNode extends AstNode {
  optional: boolean;
}

class AstCreator {
  constructor(protected _tokens: Token[]) {

  }

  create(): AstNode[] {
    this._token = this._next();

    while (true) {
      if (this._token == null) {
        break;
      } else if (this._token.type === TokenType.RawText) {
        this._nodes.push({
          type: AstNodeType.RawText,
          value: this._token.value
        });
        this._token = this._next();
      } else if (this._token.type === TokenType.CurlyOpen) {
        // enter a block
        let blockNode: BlockAstNode = {
          type: AstNodeType.Block,
          optional: false
        };
        this._nodes.push(blockNode);

        this._token = this._next();

        if (this._token == null) {
          throw new Error('Unexpected end of input: function or variable name expected');
        } else if (this._token.type === TokenType.Question) {
          blockNode.optional = true;
          this._token = this._next();

          if (this._token == null) {
            throw new Error('Unexpected end of input: function or variable expected');
          } else if (this._token.type === TokenType.Ident) {
            blockNode.children = this._handleFilterList();
            this._token = this._cur();

            if (this._token == null) {
              throw new Error('Unexpected end of input: block is unclosed');
            } else if (this._token.type === TokenType.CurlyClose) {
              // perfectly fine, go next
              this._token = this._next();
            } else {
              throw new Error(`Block ending expected, but got this: ${this._token.value}`);
            }
          }
        } else {
          blockNode.children = this._handleFilterList();
          this._token = this._cur();

          if (this._token == null) {
            throw new Error('Unexpected end of input: block is unclosed');
          } else if (this._token.type === TokenType.CurlyClose) {
            // perfectly fine, go next
            this._token = this._next();
          } else {
            throw new Error(`Block ending expected, but got this: ${this._token.value}`);
          }
        }
      } else {
        throw new Error(`Unexpected token: ${this._token.value}`);
      }
    }

    return this._nodes;
  }

  /** Protected area **/

  protected _curTokenIndex:number = -1;
  protected _token: Token|null = null;
  protected _nodes: AstNode[] = [];

  protected _next(): Token|null {
    if (this._curTokenIndex >= this._tokens.length) {
      this._token = null;
    } else {
      this._token = this._tokens[++this._curTokenIndex];
    }
    return this._token;
  }

  protected _cur(): Token|null {
    return this._token;
  }

  protected _back(): void {
    if (this._curTokenIndex === 0) {
      throw new Error('Tried to put back the first token');
    } else {
      this._token = this._tokens[--this._curTokenIndex];
    }
  }

  protected _handleFilterList(): AstNode[] {
    if (this._token == null) {
      throw new Error('Unexpected end of input: function or variable name expected');
    }

    let nodes: AstNode[] = [];

    if (this._token.type === TokenType.CurlyClose) {
      // empty filter list, this is not good
      throw new Error(`Unexpected end of block`);
    }

    while (true) {
      let funcNode = this._handleExpression();
      nodes.push(funcNode);

      if (this._token == null) {
        throw new Error('Unexpected end of input, unclosed block');
      } else if (this._token.type === TokenType.Filter) {
        // process one more filter
        this._token = this._next();
      } else if (this._token.type === TokenType.CurlyClose) {
        // end of block, we are done
        return nodes;
      } else {
        throw new Error(`Filter or end of block expected, but got this: ${this._token.value}`);
      }
    }
  }

  protected _handleExpression(): AstNode {
    if (this._token == null) {
      throw new Error('Unexpected end of input: function or variable name expected');
    }

    if (this._token.type === TokenType.String || this._token.type === TokenType.Number) {
      let node: AstNode = {
        type: AstNodeType.String,
        value: this._token.value
      };
      this._token = this._next();
      return node;
    }

    if (this._token.type !== TokenType.Ident) {
      throw new Error(`Function or variable name expected, but got this: ${this._token.value}`);
    }

    let funcNode: AstNode = {
      type: AstNodeType.FunctionOrVariable,
      value: this._token.value
    };

    this._token = this._next();

    if (this._token == null) {
      return funcNode;
    } else if (this._token.type === TokenType.BracketOpen) {
      // this is a function, let's handle its arguments
      funcNode.type = AstNodeType.Function;

      this._token = this._next();

      if (this._token == null) {
        throw new Error('Unexpected end of input, argument list expected');
      } else if (this._token.type === TokenType.BracketClose) {
        // empty argument list, perfectly valid, rewind to the next token and exit
        this._token = this._next();
        return funcNode;
      }

      funcNode.children = [];

      while (true) {
        let argNode = this._handleExpression();
        funcNode.children.push(argNode);

        if (this._token == null) {
          throw new Error('Unexpected end of input, closing bracket expected');
        } if (this._token.type === TokenType.BracketClose) {
          // end of the argument list, rewind to the next token and exit
          this._token = this._next();
          return funcNode;
        } else if (this._token.type === TokenType.Comma) {
          // one more argument, process it
          this._token = this._next();
        } else {
          throw new Error(`Argument or closing bracket expected, but got this: ${this._token.value}`);
        }
      }
    } else {
      return funcNode;
    }
  }
}

export function ast(input: string): AstNode[] {
  let creator = new AstCreator(tokenize(input));
  return creator.create();
}
