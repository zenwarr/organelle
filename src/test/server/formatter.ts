import {should, expect} from 'chai';
import {ast, AstNodeType, createPropsResolver, TemplateProcessor, tokenize, TokenType} from "../../server/formatter";

should();

describe("tokenize", function () {
  it("should process an empty string", function () {
    let tokens = tokenize('');
    expect(tokens).to.have.lengthOf(0);
  });

  it("should process an string without vars", function () {
    let tokens = tokenize('just a simple string');
    expect(tokens).to.have.lengthOf(1);
    expect(tokens[0].value).to.be.equal('just a simple string');
    expect(tokens[0].begin).to.be.equal(0);
    expect(tokens[0].length).to.be.equal('just a simple string'.length);
  });

  it("should process a template with single var", function () {
    let tokens = tokenize('this is {var}, hello');
    expect(tokens).to.have.lengthOf(5);

    expect(tokens).to.be.deep.equal([
      {
        value: 'this is ',
        begin: 0,
        length: 8,
        type: TokenType.RawText
      },
      {
        value: '{',
        begin: 8,
        length: 1,
        type: TokenType.CurlyOpen
      },
      {
        value: 'var',
        begin: 9,
        length: 3,
        type: TokenType.Name
      },
      {
        value: '}',
        begin: 12,
        length: 1,
        type: TokenType.CurlyClose
      },
      {
        value: ', hello',
        begin: 13,
        length: 7,
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
        length: 1,
        type: TokenType.CurlyOpen
      },
      {
        value: 'var',
        begin: 1,
        length: 3,
        type: TokenType.Name
      },
      {
        value: '}',
        begin: 4,
        length: 1,
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
        length: 1,
        type: TokenType.CurlyOpen
      },
      {
        value: 'var',
        begin: 2,
        length: 3,
        type: TokenType.Name
      },
      {
        value: '}',
        begin: 6,
        length: 1,
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
        length: 1,
        type: TokenType.CurlyOpen
      },
      {
        value: 'var',
        begin: 1,
        length: 3,
        type: TokenType.Name
      },
      {
        value: '}',
        begin: 4,
        length: 1,
        type: TokenType.CurlyClose
      },
      {
        value: '.',
        begin: 5,
        length: 1,
        type: TokenType.RawText
      }
    ]);
  });

  it("should reject incorrect names", function () {
    expect(() => tokenize('{@var}')).to.throw();
  });

  it("should accept correct names", function () {
    let tokens = tokenize('{_var}');
    expect(tokens).to.be.deep.equal([
      {
        value: '{',
        begin: 0,
        length: 1,
        type: TokenType.CurlyOpen
      },
      {
        value: '_var',
        begin: 1,
        length: 4,
        type: TokenType.Name
      },
      {
        value: '}',
        begin: 5,
        length: 1,
        type: TokenType.CurlyClose
      }
    ])
  });
});

describe("ast", function () {
  it("should process plain text", function () {
    let nodes = ast("just a plain text");

    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.RawText,
        value: 'just a plain text',
        children: []
      }
    ]);
  });

  it("should process a text with a simple var", function () {
    let nodes = ast('just a {var}.');

    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.RawText,
        value: 'just a ',
        children: []
      },
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: []
      },
      {
        type: AstNodeType.RawText,
        value: '.',
        children: []
      }
    ]);
  });

  it("should process a single var", function () {
    let nodes = ast('{var}');
    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: []
      }
    ]);
  });

  it("should process a var with a filter", function () {
    let nodes = ast('{var|lowercase}');
    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: [
          {
            type: AstNodeType.Function,
            value: 'lowercase',
            children: []
          }
        ]
      }
    ]);
  });

  it("should process a var with a filter function", function () {
    let nodes = ast('{var|func(a, b)}');
    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: [
          {
            type: AstNodeType.Function,
            value: 'func',
            children: [
              {
                type: AstNodeType.FunctionArgument,
                children: [
                  {
                    type: AstNodeType.String,
                    value: 'a',
                    children: []
                  }
                ]
              },
              {
                type: AstNodeType.FunctionArgument,
                children: [
                  {
                    type: AstNodeType.String,
                    value: 'b',
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ])
  });

  it("should process number arguments", function () {
    let nodes = ast('{var|func(123)}');
    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: [
          {
            type: AstNodeType.Function,
            value: 'func',
            children: [
              {
                type: AstNodeType.FunctionArgument,
                children: [
                  {
                    type: AstNodeType.Number,
                    value: 123,
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]);
  });

  it("should not process a var without a name", function () {
    expect(() => ast('{}')).to.throw();
  });

  it("should process a filter without arguments", function () {
    let nodes = ast('{var|func()}');
    expect(nodes).to.be.deep.equal([
      {
        type: AstNodeType.Variable,
        value: 'var',
        children: [
          {
            type: AstNodeType.Function,
            value: 'func',
            children: []
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
});

describe("process", function () {
  let propsObj = {
    'var': 'some value',
    uc: 'SOME VALUE'
  };
  let proc: TemplateProcessor;

  beforeEach(function () {
    proc = new TemplateProcessor(createPropsResolver(propsObj));
  });

  it("should resolve vars", function () {
    expect(proc.process('{var}')).to.be.equal('some value');
  });

  it("should process variable names regardless of case", function () {
    expect(proc.process('{VAR}')).to.be.equal('some value');
  });

  it("should apply filters", function () {
    expect(proc.process('{uc}')).to.be.equal('SOME VALUE');
    expect(proc.process('{uc|lowercase}')).to.be.equal('some value');
  });

  it("should resolve non-existent vars to empty strings", function () {
    expect(proc.process('look: {does_not_exist}')).to.be.equal('look: ');
  });

  it("should throw in strict mode", function () {
    proc.strictVarResolve = true;
    expect(() => proc.process('look: {does_not_exist}')).to.throw();
  });
});
