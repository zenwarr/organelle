import {should, expect} from 'chai';
import {
  ast, AstNodeType, createPropsResolver, replaceEscapeSequences, TemplateProcessor, tokenize,
  TokenType
} from "../../server/formatter";

should();

describe("formatter", function () {
  describe("tokenize", function () {
    it("should process an empty string", function () {
      let tokens = tokenize('');
      expect(tokens).to.have.lengthOf(0);
    });

    it("should process an string without vars", function () {
      let tokens = tokenize('just a simple string');
      expect(tokens).to.be.deep.equal([
        {
          value: 'just a simple string',
          begin: 0,
          type: TokenType.RawText
        }
      ]);
    });

    it("should process a template with single var", function () {
      let tokens = tokenize('this is {var}, hello');
      expect(tokens).to.have.lengthOf(5);

      expect(tokens).to.be.deep.equal([
        {
          value: 'this is ',
          begin: 0,
          type: TokenType.RawText
        },
        {
          value: '{',
          begin: 8,
          type: TokenType.CurlyOpen
        },
        {
          value: 'var',
          begin: 9,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 12,
          type: TokenType.CurlyClose
        },
        {
          value: ', hello',
          begin: 13,
          type: TokenType.RawText
        }
      ])
    });

    it("should process a template consisting of the only var", function () {
      let tokens = tokenize('{var}');
      expect(tokens).to.have.lengthOf(3);

      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: 'var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 4,
          type: TokenType.CurlyClose
        }
      ]);
    });

    it("should cut whitespaces out of variable name", function () {
      let tokens = tokenize('{ var }');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: 'var',
          begin: 2,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 6,
          type: TokenType.CurlyClose
        }
      ]);
    });

    it("should process var with trailing single char", function () {
      let tokens = tokenize('{var}.');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: 'var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 4,
          type: TokenType.CurlyClose
        },
        {
          value: '.',
          begin: 5,
          type: TokenType.RawText
        }
      ]);
    });

    it("should accept correct names", function () {
      let tokens = tokenize('{_var}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: '_var',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 5,
          type: TokenType.CurlyClose
        }
      ])
    });

    it("should accept many different symbols", function () {
      let tokens = tokenize('{_821some.#quant}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: '_821some.#quant',
          begin: 1,
          type: TokenType.Ident
        },
        {
          value: '}',
          begin: 16,
          type: TokenType.CurlyClose
        }
      ]);
    });

    it("should not accept invalid names", function () {
      expect(() => tokenize('{#name}')).to.throw();
      expect(() => tokenize('{.name}')).to.throw();
    });

    it("should handle whitespace", function () {
      let tokens = tokenize('{ }');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          type: TokenType.CurlyOpen,
          begin: 0,
        },
        {
          value: '}',
          type: TokenType.CurlyClose,
          begin: 2
        }
      ]);
    });

    it("should handle quoted strings", function () {
      let tokens = tokenize("{'some \\'quoted\\' shit'}");
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: "some \'quoted\' shit",
          begin: 1,
          type: TokenType.String
        },
        {
          value: '}',
          begin: 23,
          type: TokenType.CurlyClose
        }
      ]);
    });

    it("should handle quoted strings (with double quotes)", function () {
      let tokens = tokenize('{"some \\"quoted\\" shit"}');
      expect(tokens).to.be.deep.equal([
        {
          value: '{',
          begin: 0,
          type: TokenType.CurlyOpen
        },
        {
          value: 'some \"quoted\" shit',
          begin: 1,
          type: TokenType.String
        },
        {
          value: '}',
          begin: 23,
          type: TokenType.CurlyClose
        }
      ]);
    });

    it("should handle numbers", function () {
      let tokens = tokenize('{012}');
      expect(tokens).to.be.deep.equal([
        {
          type: TokenType.CurlyOpen,
          value: '{',
          begin: 0
        },
        {
          type: TokenType.Number,
          value: '012',
          begin: 1,
        },
        {
          type: TokenType.CurlyClose,
          value: '}',
          begin: 4
        }
      ])
    });

    it("should not accept identifiers starting with digits", function () {
      expect(() => tokenize('{123_}')).to.throw();
    });

    it("should handle escape sequences", function () {
      let tokens = tokenize('{"\\tvar"}');
      expect(tokens[1]).to.be.deep.equal({
        type: TokenType.String,
        value: '\tvar',
        begin: 1
      });
    });
  });

  describe("ast", function () {
    it("should process plain text", function () {
      let nodes = ast("just a plain text");

      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.RawText,
          value: 'just a plain text'
        }
      ]);
    });

    it("should process a text with a simple var", function () {
      let nodes = ast('just a {var}.');

      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.RawText,
          value: 'just a '
        },
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        },
        {
          type: AstNodeType.RawText,
          value: '.'
        }
      ]);
    });

    it("should process a single var", function () {
      let nodes = ast('{var}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        }
      ]);
    });

    it("should process a single optional block", function () {
      let nodes = ast('{?var}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: true,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            }
          ]
        }
      ]);
    });

    it("should process a var with a filter", function () {
      let nodes = ast('{var|lowercase}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var',
            },
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'lowercase'
            }
          ]
        }
      ]);
    });

    it("should process a var with a filter function", function () {
      let nodes = ast('{var|func(a, b)}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
              children: [
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'a'
                },
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'b'
                }
              ]
            }
          ]
        }
      ])
    });

    it("should not process a var without a name", function () {
      expect(() => ast('{}')).to.throw();
    });

    it("should process a filter without arguments", function () {
      let nodes = ast('{var|func()}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
            }
          ]
        }
      ])
    });

    it("should not process a broken syntax", function () {
      expect(() => ast('{unclosed')).to.throw();
      expect(() => ast('{unclosed|')).to.throw();
      expect(() => ast('{unclosed|func')).to.throw();
      expect(() => ast('{unclosed|func(}')).to.throw();
      expect(() => ast('{var|func(|)}')).to.throw();
    });

    it("should process nested calls", function () {
      let nodes = ast('{var|func(func2(a),b)}');
      expect(nodes).to.be.deep.equal([
        {
          type: AstNodeType.Block,
          optional: false,
          children: [
            {
              type: AstNodeType.FunctionOrVariable,
              value: 'var'
            },
            {
              type: AstNodeType.Function,
              value: 'func',
              children: [
                {
                  type: AstNodeType.Function,
                  value: 'func2',
                  children: [
                    {
                      type: AstNodeType.FunctionOrVariable,
                      value: 'a'
                    }
                  ]
                },
                {
                  type: AstNodeType.FunctionOrVariable,
                  value: 'b'
                }
              ]
            }
          ]
        }
      ])
    });

    it("should not process invalid token sequences", function () {
      expect(() => ast('{func(')).to.throw();
      expect(() => ast('{?')).to.throw();
      expect(() => ast('{func')).to.throw();
      expect(() => ast("{'func'")).to.throw();
      expect(() => ast('{}')).to.throw();
      expect(() => ast('{func|func>func}')).to.throw();
      expect(() => ast('{')).to.throw();
    });
  });

  describe("process", function () {
    let propsObj = {
      'var': 'some value',
      UC_var: 'some value',
      uc: 'SOME VALUE',
      empty: '',
      obj: {
        prop: 'prop value'
      },
      arr: ['first', 'second', 'third']
    };
    let proc: TemplateProcessor;

    beforeEach(function () {
      proc = new TemplateProcessor(createPropsResolver(propsObj));
    });

    it("should process plain text", function () {
      expect(proc.process('just a text')).to.be.equal('just a text');
    });

    it("should resolve vars", function () {
      expect(proc.process('{var}')).to.be.equal('some value');
    });

    it("should process variable names regardless of case", function () {
      expect(proc.process('{uc_VAR}')).to.be.equal('some value');
    });

    it("should process variable surrounded with spaces", function () {
      expect(proc.process('{ var }')).to.be.equal('some value');
    });

    it("should apply filters", function () {
      expect(proc.process('{uc}')).to.be.equal('SOME VALUE');
      expect(proc.process('{uc|lowercase}')).to.be.equal('some value');
      expect(proc.process('{ uc | lowercase }')).to.be.equal('some value');
    });

    it("should resolve non-existent vars to empty strings", function () {
      expect(proc.process('look: {does_not_exist}')).to.be.equal('look: ');
    });

    it("should throw in strict mode", function () {
      proc.strictVarResolve = true;
      expect(() => proc.process('look: {does_not_exist}')).to.throw();
    });

    it("should handle strings and numbers", function () {
      expect(proc.process('{"123"}')).to.be.equal('123');
      expect(proc.process('{123}')).to.be.equal('123');
    });

    it("lorem function should work", function () {
      expect(proc.process('{any|_lorem(1)}')).to.be.equal('Lorem');
    });

    it("function should be allowed to generate head value", function () {
      expect(proc.process('{_lorem(2)}')).to.be.equal('Lorem ipsum');
      expect(proc.process('{_lorem(2)|_lorem(3)}')).to.be.equal('Lorem ipsum dolor');
    });

    it("nested calls", function () {
      expect(proc.process('{ _lorem(add(1, 2)) }')).to.be.equal('Lorem ipsum dolor');
    });

    it("optional blocks", function () {
      expect(proc.process('{empty|wrap("[@]")}')).to.be.equal('[]');
      expect(proc.process('{?empty|wrap("[@]")}')).to.be.equal('');
    });

    it("specifiers", function () {
      expect(proc.process('{obj#prop}')).to.be.equal('prop value');
      expect(proc.process('{arr#1}')).to.be.equal('second');
      expect(proc.process('{arr#4}')).to.be.equal('');
    });
  });

  describe("replaceEscapeSequences", function () {
    it("should replace", function () {
      expect(replaceEscapeSequences('some text')).to.be.equal('some text');
      expect(replaceEscapeSequences('some \\t tab')).to.be.equal('some \t tab');
      expect(replaceEscapeSequences('\\t')).to.be.equal('\t');
      expect(replaceEscapeSequences('\\t some text')).to.be.equal('\t some text');
      expect(replaceEscapeSequences('\\t\\r')).to.be.equal('\t\r');
      expect(replaceEscapeSequences('\\t\\rx')).to.be.equal('\t\rx');
      expect(replaceEscapeSequences('\\\\')).to.be.equal('\\');
      expect(() => replaceEscapeSequences('\\x')).to.throw();
      expect(() => replaceEscapeSequences('\\')).to.throw();
    });
  });
});
