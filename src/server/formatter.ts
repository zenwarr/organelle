export type VarResolver = (name: string) => string|null;
export type FilterResolver = (value: string, ...args: any[]) => string;

export function createPropsResolver(obj: any): VarResolver {
  return function(name: string): string|null {
    if (Object.keys(obj).map(key => key.toLowerCase()).indexOf(name) >= 0) {
      let result = obj[name];
      return result == null ? '' : '' + result;
    }
    return null;
  }
}

const DEFAULT_FILTERS: { [name: string]: FilterResolver } = {
  lowercase: input => input.toLowerCase(),
  uppercase: input => input.toUpperCase(),
  trim: input => input.trim(),
  def: (input: string, ...args: any[]): string => {
    if (args.length < 1) {
      throw new FilterArgumentsError(1);
    }
    return input.length === 0 ? '' + args[0] : input;
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

  addFilterResolver(name: string, resolver: FilterResolver): void {
    name = name.toLowerCase();
    if (!isValidName(name)) {
      throw new Error(`Cannot add a new filter named ${name}: this is an invalid name for a filter`);
    }
    if (this._filterResolvers.name != null) {
      throw new Error(`Cannot add a new filter named ${name}: filter already registered`);
    }
    if (resolver == null) {
      throw new Error(`Cannot add a new filter named ${name}: invalid resolver`);
    }
    this._filterResolvers[name] = resolver;
  }

  process(input: string): string {
    let nodes = ast(input);
    if (nodes.length === 0) {
      return '';
    }

    let parts: string[] = [];

    for (let node of nodes) {
      if (node.type === AstNodeType.RawText) {
        parts.push(node.value);
      } else if (node.type === AstNodeType.Variable) {
        let varName = node.value;

        let curValue = this.resolveVar(varName);
        if (curValue == null) {
          if (this._strictVarResolve) {
            throw new Error(`Cannot resolve a variable named ${node.value}`);
          } else {
            curValue = '';
          }
        }

        if (node.children != null) {
          for (let filterNode of node.children) {
            if (filterNode.type !== AstNodeType.Function) {
              throw new Error();
            }

            let filterName = filterNode.value.toLowerCase();

            let filterArgs: any[];

            if (filterNode.children != null && filterNode.children.length > 0) {
              let isEverythingValid = filterNode.children.every(argNode => {
                return argNode.children != null && argNode.children.length === 1 && argNode.children[0].value != null;
              });

              if (!isEverythingValid) {
                throw new Error();
              }

              filterArgs = filterNode.children.map(argNode => argNode.children[0].value);
            } else {
              filterArgs = [];
            }

            let resolvedValue: string|null;
            try {
              resolvedValue = this.resolveFilter(filterName, curValue, ...filterArgs);
            } catch (err) {
              if (err instanceof FilterArgumentsError) {
                throw new Error(`Cannot process a variable ${node.value} with a filter ${filterName}:` +
                    `${err.reqArgsCount} expected, but got ${filterArgs.length}`);
              }
              throw err;
            }

            if (resolvedValue == null) {
              throw new Error(`Cannot process a value with a filter named ${filterName}: no such filter found`);
            }
            curValue = resolvedValue;
          }
        }

        parts.push(curValue);
      }
    }

    return parts.join('');
  }

  resolveVar(name: string): string|null {
    name = name.toLowerCase();
    for (let resolver of this._varResolvers) {
      let resolved = resolver(name);
      if (resolved != null) {
        return resolved;
      }
    }
    return null;
  }

  resolveFilter(name: string, input: string, ...args: any[]): string|null {
    name = name.toLowerCase();
    if (this._filterResolvers[name] != null) {
      return this._filterResolvers[name](input, ...args);
    } else if (DEFAULT_FILTERS[name] != null) {
      return DEFAULT_FILTERS[name](input, ...args);
    } else {
      return null;
    }
  }

  get strictVarResolve(): boolean { return this._strictVarResolve; }
  set strictVarResolve(value: boolean) { this._strictVarResolve = value; }

  /** Protected area **/

  protected _varResolvers: VarResolver[] = [];
  protected _filterResolvers: { [name: string]: FilterResolver } = {};
  protected _strictVarResolve: boolean;
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
  Number,
  Name
}

interface Token {
  value: string;
  begin: number;
  length: number;
  type: TokenType;
}

const CHAR_CURLY_OPEN = '{'.charCodeAt(0);
const CHAR_CURLY_CLOSE = '}'.charCodeAt(0);
const CHAR_FILTER = '|'.charCodeAt(0);
const CHAR_COMMA = ','.charCodeAt(0);
const CHAR_BRACKET_OPEN = '('.charCodeAt(0);
const CHAR_BRACKET_CLOSE = ')'.charCodeAt(0);
const CHAR_UNDERSCORE = '_'.charCodeAt(0);
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
      length: head - tail + 1 - back,
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
      } else if (isWhitespaceCode(ch)) {
        do {
          ch = nextChar();
        } while (ch != null && isWhitespaceCode(ch));
        eat();
      } else if (isAlphaCode(ch) || ch === CHAR_UNDERSCORE) {
        do {
          ch = nextChar();
        } while (ch != null && (isAlphaCode(ch) || isDigitCode(ch) || ch === CHAR_UNDERSCORE));

        pushToken(TokenType.Name, 1);
        eat();
      } else if (isDigitCode(ch)) {
        do {
          ch = nextChar();
        } while (ch != null && (isDigitCode(ch)));

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
  Variable,
  Function,
  FunctionArgument,
  Number,
  String
}

export interface AstNode {
  type: AstNodeType;
  value?: any;
  children: AstNode[];
}

export function createAst(tokens: Token[]): AstNode[] {
  let nodes: AstNode[] = [];

  let curTokenIndex = -1;
  let token: Token|null;

  function next(): Token|null {
    if (curTokenIndex >= tokens.length) {
      return null;
    } else {
      return tokens[++curTokenIndex];
    }
  }

  function back(): Token {
    if (curTokenIndex === 0) {
      throw new Error("Tried to put back the first token");
    } else {
      return tokens[--curTokenIndex];
    }
  }

  while (true) {
    token = next();

    if (token == null) {
      break;
    } else if (token.type === TokenType.RawText) {
      nodes.push({
        type: AstNodeType.RawText,
        value: token.value,
        children: []
      });
    } else if (token.type === TokenType.CurlyOpen) {
      // enter a variable block
      token = next();
      let varNode: AstNode = {
        type: AstNodeType.Variable,
        children: [],
      };
      nodes.push(varNode);

      if (token == null) {
        throw new Error('Unexpected end of input: variable block is unclosed');
      } else if (token.type === TokenType.Name) {
        // this is the name of the variable
        varNode.value = token.value;

        token = next();

        if (token == null) {
          throw new Error("Unexpected end of input: variable block is unclosed");
        } else if (token.type === TokenType.CurlyClose) {
          // all done, continue processing
        } else if (token.type === TokenType.Filter) {
          // enter filters area
          function handleFilter(): void {
            // starts with a token right after filter separator
            // returns true if we should stop processing filters, or false if we should try to process
            // another one
            if (token == null) {
              throw new Error(`Unexpected end of input: more input expected after an filter separator`);
            } else if (token.type === TokenType.Name) {
              // handle a function call
              let funcNode: AstNode = {
                type: AstNodeType.Function,
                value: token.value,
                children: []
              };
              varNode.children.push(funcNode);

              token = next();

              if (token == null) {
                throw new Error(`Unexpected end of input, unclosed variable block`);
              } else if (token.type == TokenType.BracketOpen) {
                // handle filter arguments
                let curArgCount = 0;

                while (true) {
                  token = next();

                  if (token == null) {
                    throw new Error('Unexpected end of input, function arguments expected');
                  } else if (token.type === TokenType.Name || token.type === TokenType.Number) {
                    let valueNode: AstNode;

                    if (token.type === TokenType.Name) {
                      valueNode = {
                        type: AstNodeType.String,
                        value: token.value,
                        children: []
                      };
                    } else {
                      valueNode = {
                        type: AstNodeType.Number,
                        value: parseInt(token.value),
                        children: []
                      };
                    }

                    let argNode: AstNode = {
                      type: AstNodeType.FunctionArgument,
                      children: [ valueNode ]
                    };
                    funcNode.children.push(argNode);
                    ++curArgCount;
                  } else if (token.type === TokenType.BracketClose) {
                    // no more arguments, fine
                    break;
                  } else if (token.type === TokenType.Comma && curArgCount > 0) {
                    // one more argument
                  } else {
                    throw new Error(`Argument value expected, but got this: ${token.value}`);
                  }
                }
              } else {
                token = back();
              }
            } else {
              throw new Error(`Filter name expected, but got this: ${token.value}`);
            }
          }

          token = next();
          handleFilter();

          while (true) {
            token = next();
            if (token == null) {
              throw new Error('Unexpected end of input: variable block is unclosed');
            } else if (token.type === TokenType.Filter) {
              // try one more filter
              token = next();
              handleFilter();
            } else if (token.type === TokenType.CurlyClose) {
              // done, no more filters
              break;
            }
          }
        } else {
          throw new Error(`A filter separator or end of variable block expected, but got this: ${token.value}`);
        }
      } else {
        throw new Error(`A name expected, but got this: ${token.value}`);
      }
    } else {
      throw new Error(`A raw text or variable block expected, but got this: ${token.value}`);
    }
  }

  return nodes;
}

export function ast(input: string): AstNode[] {
  return createAst(tokenize(input));
}
