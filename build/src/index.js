'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _utils = require('./utils');

var isProd = process.env.NODE_ENV === 'production';

var COMPOUND = isProd ? 1 : 'Compound';
var IDENTIFIER = isProd ? 2 : 'Identifier';
var MEMBER_EXP = isProd ? 3 : 'MemberExpression';
var LITERAL = isProd ? 4 : 'Literal';
var THIS_EXP = isProd ? 5 : 'ThisExpression';
var CALL_EXP = isProd ? 6 : 'CallExpression';
var UNARY_EXP = isProd ? 7 : 'UnaryExpression';
var BINARY_EXP = isProd ? 8 : 'BinaryExpression';
var LOGICAL_EXP = isProd ? 9 : 'LogicalExpression';
var CONDITIONAL_EXP = isProd ? 10 : 'ConditionalExpression';
var ARRAY_EXP = isProd ? 11 : 'ArrayExpression';

var PERIOD_CODE = 46; // '.'
var COMMA_CODE = 44; // ','
var SQUOTE_CODE = 39; // single quote
var DQUOTE_CODE = 34; // double quotes
var OPAREN_CODE = 40; // (
var CPAREN_CODE = 41; // )
var OBRACK_CODE = 91; // [
var CBRACK_CODE = 93; // ]
var QUMARK_CODE = 63; // ?
var SEMCOL_CODE = 59; // ;
var COLON_CODE = 58; // :


// Operations
//

var t = true;
var OPERATOR_PLUS = '+';
var OPERATOR_MINUS = '-';
var OPERATOR_DIVISION = '/';
var OPERATOR_MULTIPLE = '*';
var OPERATOR_POW = '^';
var OPERATOR_GT = '>';
var OPERATOR_GTE = '>=';
var OPERATOR_LT = '<';
var OPERATOR_LTE = '<=';

var OPERATOR_NOT = '!';
var OPERATOR_BOOL = '!!';
var OPERATOR_INT = '~~';

//
var evals = {};

evals[OPERATOR_PLUS] = function (a, b) {
  return a + b;
};
evals[OPERATOR_MINUS] = function (a, b) {
  return a - b;
};
evals[OPERATOR_DIVISION] = function (a, b) {
  return a / b;
};
evals[OPERATOR_MULTIPLE] = function (a, b) {
  return a * b;
};
evals[OPERATOR_POW] = function (a, b) {
  return Math.pow(a, b);
};
evals[OPERATOR_GT] = function (a, b) {
  return a > b;
};
evals[OPERATOR_GTE] = function (a, b) {
  return a >= b;
};
evals[OPERATOR_LT] = function (a, b) {
  return a < b;
};
evals[OPERATOR_LTE] = function (a, b) {
  return a <= b;
};

evals[OPERATOR_NOT] = function (x) {
  return !x;
};
evals[OPERATOR_BOOL] = function (x) {
  return !!x;
};
evals[OPERATOR_INT] = function (x) {
  return ~~x;
};

// Use a quickly-accessible map to store all of the unary operators
var unary_ops = {
  '-': 1,
  '!': 1,
  '~': 1,
  '+': 1
};

var literals = {
  'true': true,
  'false': false,
  'null': null

  // Also use a map for the binary operations but set their values to their
  // binary precedence for quick reference:
  // see [Order of operations](http://en.wikipedia.org/wiki/Order_of_operations#Programming_language)
};var binary_ops = {
  '->': 0,
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '===': 6,
  '!==': 6,
  '<': 7,
  '>': 7,
  '<=': 7,
  '>=': 7,
  '<<': 8,
  '>>': 8,
  '>>>': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10
};

var max_unop_len = (0, _utils.getMaxKeyLen)(unary_ops);
var max_binop_len = (0, _utils.getMaxKeyLen)(binary_ops);
// Literals
// ----------
// Store the values to return for the various literals we may encounter

// Except for `this`, which is special. This could be changed to something like `'self'` as well
var this_str = 'this';

// Returns the precedence of a binary operator or `0` if it isn't a binary operator
var binaryPrecedence = function binaryPrecedence(op_val) {
  return binary_ops[op_val] || 0;
};

// Utility function (gets called from multiple places)
// Also note that `a && b` and `a || b` are *logical* expressions, not binary expressions
var createBinaryExpression = function createBinaryExpression(operator, left, right) {
  return {
    operator: operator, left: left, right: right,
    type: operator === '||' || operator === '&&' ? LOGICAL_EXP : BINARY_EXP
  };
};

// `ch` is a character code in the next three functions
var isDecimalDigit = function isDecimalDigit(ch) {
  return ch >= 48 && ch <= 57;
};

var isIdentifierStart = function isIdentifierStart(ch) {
  return ch === 36 || ch === 95 || // `$` and `_`
  ch >= 65 && ch <= 90 || // A...Z
  ch >= 97 && ch <= 122 || // a...z
  ch >= 128 && !binary_ops[String.fromCharCode(ch)] // any non-ASCII that is not an operator
  ;
};

var isIdentifierPart = function isIdentifierPart(ch, partial) {
  return ch === 36 || ch === 95 || // `$` and `_`
  ch >= 65 && ch <= 90 || // A...Z
  ch >= 97 && ch <= 122 || // a...z
  ch >= 48 && ch <= 57 || // 0...9
  ch >= 128 && !binary_ops[String.fromCharCode(ch)] // any non-ASCII that is not an operator
  ;
};

var exprIBuild = function exprIBuild(expr) {
  var charAtFunc = expr.charAt;
  return function (index) {
    return charAtFunc.call(expr, index);
  };
};

var exprICodeBuild = function exprICodeBuild(expr) {
  var charCodeAtFunc = expr.charCodeAt;
  return function (index) {
    return charCodeAtFunc.call(expr, index);
  };
};

var gobbleSpaces = function gobbleSpaces(expr, index) {
  var ch = expr.charCodeAt(index);
  while (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
    // space or tab
    ch = expr.charAt(++index);
  }
  return index;
};

// Search for the operation portion of the string (e.g. `+`, `===`)
// Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
// and move down from 3 to 2 to 1 character until a matching binary operation is found
// then, return that binary operation
var gobbleBinaryOp = function gobbleBinaryOp(expr, index) {
  index = gobbleSpaces(expr, index);
  var to_check = expr.substr(index, max_binop_len);
  var tc_len = to_check.length;
  while (tc_len > 0) {
    if (binary_ops.hasOwnProperty(to_check)) {
      index += tc_len;
      return { to_check: to_check, index: index };
    }
    to_check = to_check.substr(0, --tc_len);
  }
  return { index: index };
};

// Parsing
// -------
// `expr` is a string with the passed in expression
var parser = function parser(expr) {
  // const tmp = expr.split('->')
  // expr = tmp.map((e, i) => {
  //   return '('.repeat(tmp.length - i) + e + ')'
  // }).join('')

  // `index` stores the character number we are currently at while `length` is a constant
  // All of the gobbles below will modify `index` as we move along
  var index = 0;

  var exprI = exprIBuild(expr);
  var exprICode = exprICodeBuild(expr);
  var length = expr.length;

  // Push `index` up to the next non-space character


  // The main parsing function. Much of this code is dedicated to ternary expressions

  var gobbleExpression = function gobbleExpression() {
    var test = gobbleBinaryExpression(),
        consequent,
        alternate;
    index = gobbleSpaces(expr, index);
    if (exprICode(index) === QUMARK_CODE) {
      // Ternary expression: test ? consequent : alternate
      index++;
      consequent = gobbleExpression();
      if (!consequent) {
        (0, _utils.throwError)('Expected expression', index);
      }
      index = gobbleSpaces(expr, index);
      if (exprICode(index) === COLON_CODE) {
        index++;
        alternate = gobbleExpression();
        if (!alternate) {
          (0, _utils.throwError)('Expected expression', index);
        }
        return {
          type: CONDITIONAL_EXP,
          test: test,
          consequent: consequent,
          alternate: alternate
        };
      } else {
        (0, _utils.throwError)('Expected :', index);
      }
    } else {
      return test;
    }
  },


  // This function is responsible for gobbling an individual expression,
  // e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
  gobbleBinaryExpression = function gobbleBinaryExpression() {
    var node, biop, prec, stack, biop_info, left, right, i;

    // First, try to get the leftmost thing
    // Then, check to see if there's a binary operator operating on that leftmost thing
    left = gobbleToken();
    biop = gobbleBinaryOp(expr, index);
    index = biop.index;

    // If there wasn't a binary operator, just return the leftmost node
    if (!biop.to_check) {
      return left;
    }

    // Otherwise, we need to start a stack to properly place the binary operations in their
    // precedence structure
    biop_info = { value: biop.to_check, prec: binaryPrecedence(biop.to_check) };

    right = gobbleToken();
    if (!right) {
      (0, _utils.throwError)('Expected expression after ' + biop.to_check, index);
    }
    stack = [left, biop_info, right];

    // Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
    while (biop = gobbleBinaryOp(expr, index)) {
      index = biop.index;
      prec = binaryPrecedence(biop.to_check);

      if (prec === 0) {
        break;
      }

      biop_info = { value: biop.to_check, prec: prec

        // Reduce: make a binary expression from the three topmost entries.
      };while (stack.length > 2 && prec <= stack[stack.length - 2].prec) {
        right = stack.pop();
        biop = stack.pop().value;
        left = stack.pop();
        node = createBinaryExpression(biop, left, right);
        stack.push(node);
      }

      node = gobbleToken();
      if (!node) {
        (0, _utils.throwError)('Expected expression after ' + biop, index);
      }
      stack.push(biop_info, node);
    }

    i = stack.length - 1;
    node = stack[i];
    while (i > 1) {
      node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node);
      i -= 2;
    }
    return node;
  },


  // An individual part of a binary expression:
  // e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
  gobbleToken = function gobbleToken() {
    var ch, to_check, tc_len;

    index = gobbleSpaces(expr, index);
    ch = exprICode(index);

    if (isDecimalDigit(ch) || ch === PERIOD_CODE) {
      // Char code 46 is a dot `.` which can start off a numeric literal
      return gobbleNumericLiteral();
    } else if (ch === SQUOTE_CODE || ch === DQUOTE_CODE) {
      // Single or double quotes
      return gobbleStringLiteral();
    } else if (ch === OBRACK_CODE) {
      return gobbleArray();
    } else {
      to_check = expr.substr(index, max_unop_len);
      tc_len = to_check.length;
      while (tc_len > 0) {
        if (unary_ops.hasOwnProperty(to_check)) {
          index += tc_len;
          return {
            type: UNARY_EXP,
            operator: to_check,
            argument: gobbleToken(),
            prefix: true
          };
        }
        to_check = to_check.substr(0, --tc_len);
      }

      if (isIdentifierStart(ch) || ch === OPAREN_CODE) {
        // open parenthesis
        // `foo`, `bar.baz`
        return gobbleVariable();
      }
    }

    return false;
  },

  // Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
  // keep track of everything in the numeric literal and then calling `parseFloat` on that string
  gobbleNumericLiteral = function gobbleNumericLiteral() {
    var number = '',
        ch,
        chCode;
    while (isDecimalDigit(exprICode(index))) {
      number += exprI(index++);
    }

    if (exprICode(index) === PERIOD_CODE) {
      // can start with a decimal marker
      number += exprI(index++);

      while (isDecimalDigit(exprICode(index))) {
        number += exprI(index++);
      }
    }

    ch = exprI(index);
    if (ch === 'e' || ch === 'E') {
      // exponent marker
      number += exprI(index++);
      ch = exprI(index);
      if (ch === '+' || ch === '-') {
        // exponent sign
        number += exprI(index++);
      }
      while (isDecimalDigit(exprICode(index))) {
        //exponent itself
        number += exprI(index++);
      }
      if (!isDecimalDigit(exprICode(index - 1))) {
        (0, _utils.throwError)('Expected exponent (' + number + exprI(index) + ')', index);
      }
    }

    chCode = exprICode(index);
    // Check to make sure this isn't a variable name that start with a number (123abc)
    if (isIdentifierStart(chCode)) {
      (0, _utils.throwError)('Variable names cannot start with a number (' + number + exprI(index) + ')', index);
    } else if (chCode === PERIOD_CODE) {
      (0, _utils.throwError)('Unexpected period', index);
    }

    return {
      type: LITERAL,
      value: parseFloat(number),
      raw: number
    };
  },


  // Parses a string literal, staring with single or double quotes with basic support for escape codes
  // e.g. `"hello world"`, `'this is\nparser'`
  gobbleStringLiteral = function gobbleStringLiteral() {
    var str = '',
        quote = exprI(index++),
        closed = false,
        ch;

    while (index < length) {
      ch = exprI(index++);
      if (ch === quote) {
        closed = true;
        break;
      } else if (ch === '\\') {
        // Check for all of the common escape codes
        ch = exprI(index++);
        switch (ch) {
          case 'n':
            str += '\n';break;
          case 'r':
            str += '\r';break;
          case 't':
            str += '\t';break;
          case 'b':
            str += '\b';break;
          case 'f':
            str += '\f';break;
          case 'v':
            str += '\x0B';break;
          default:
            str += ch;
        }
      } else {
        str += ch;
      }
    }

    if (!closed) {
      (0, _utils.throwError)('Unclosed quote after "' + str + '"', index);
    }

    return {
      type: LITERAL,
      value: str,
      raw: quote + str + quote
    };
  },


  // Gobbles only identifiers
  // e.g.: `foo`, `_value`, `$x1`
  // Also, this function checks if that identifier is a literal:
  // (e.g. `true`, `false`, `null`) or `this`
  gobbleIdentifier = function gobbleIdentifier() {
    var ch = exprICode(index),
        start = index,
        identifier;

    if (isIdentifierStart(ch)) {
      index++;
    } else {
      (0, _utils.throwError)('Unexpected ' + exprI(index), index);
    }

    while (index < length) {
      ch = exprICode(index);
      if (isIdentifierPart(ch)) {
        index++;
      } else {
        break;
      }
    }
    identifier = expr.slice(start, index);

    if (literals.hasOwnProperty(identifier)) {
      return {
        type: LITERAL,
        value: literals[identifier],
        raw: identifier
      };
    } else if (identifier === this_str) {
      return { type: THIS_EXP };
    } else {
      return {
        type: IDENTIFIER,
        name: identifier
      };
    }
  },


  // Gobbles a list of arguments within the context of a function call
  // or array literal. This function also assumes that the opening character
  // `(` or `[` has already been gobbled, and gobbles expressions and commas
  // until the terminator character `)` or `]` is encountered.
  // e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
  gobbleArguments = function gobbleArguments(termination) {
    var ch_i,
        args = [],
        node,
        closed = false;
    while (index < length) {
      index = gobbleSpaces(expr, index);
      ch_i = exprICode(index);
      if (ch_i === termination) {
        // done parsing
        closed = true;
        index++;
        break;
      } else if (ch_i === COMMA_CODE) {
        // between expressions
        index++;
      } else {
        node = gobbleExpression();
        if (!node || node.type === COMPOUND) {
          (0, _utils.throwError)('Expected comma', index);
        }
        args.push(node);
      }
    }
    if (!closed) {
      (0, _utils.throwError)('Expected ' + String.fromCharCode(termination), index);
    }
    return args;
  },


  // Gobble a non-literal variable name. This variable name may include properties
  // e.g. `foo`, `bar.baz`, `foo['bar'].baz`
  // It also gobbles function calls:
  // e.g. `Math.acos(obj.angle)`
  gobbleVariable = function gobbleVariable() {
    var ch_i, node;
    ch_i = exprICode(index);

    if (ch_i === OPAREN_CODE) {
      node = gobbleGroup();
    } else {
      node = gobbleIdentifier();
    }
    index = gobbleSpaces(expr, index);
    ch_i = exprICode(index);
    while (ch_i === PERIOD_CODE || ch_i === OBRACK_CODE || ch_i === OPAREN_CODE) {
      index++;
      if (ch_i === PERIOD_CODE) {
        index = gobbleSpaces(expr, index);
        node = {
          type: MEMBER_EXP,
          computed: false,
          object: node,
          property: gobbleIdentifier()
        };
      } else if (ch_i === OBRACK_CODE) {
        node = {
          type: MEMBER_EXP,
          computed: true,
          object: node,
          property: gobbleExpression()
        };
        index = gobbleSpaces(expr, index);
        ch_i = exprICode(index);
        if (ch_i !== CBRACK_CODE) {
          (0, _utils.throwError)('Unclosed [', index);
        }
        index++;
      } else if (ch_i === OPAREN_CODE) {
        // A function call is being made; gobble all the arguments
        node = {
          type: CALL_EXP,
          'arguments': gobbleArguments(CPAREN_CODE),
          callee: node
        };
      }
      index = gobbleSpaces(expr, index);
      ch_i = exprICode(index);
    }
    return node;
  },


  // Responsible for parsing a group of things within parentheses `()`
  // This function assumes that it needs to gobble the opening parenthesis
  // and then tries to gobble everything within that parenthesis, assuming
  // that the next thing it should see is the close parenthesis. If not,
  // then the expression probably doesn't have a `)`
  gobbleGroup = function gobbleGroup() {
    index++;
    var node = gobbleExpression();
    index = gobbleSpaces(expr, index);
    if (exprICode(index) === CPAREN_CODE) {
      index++;
      return node;
    } else {
      (0, _utils.throwError)('Unclosed (', index);
    }
  },


  // Responsible for parsing Array literals `[1, 2, 3]`
  // This function assumes that it needs to gobble the opening bracket
  // and then tries to gobble the expressions as arguments.
  gobbleArray = function gobbleArray() {
    index++;
    return {
      type: ARRAY_EXP,
      elements: gobbleArguments(CBRACK_CODE)
    };
  },
      nodes = [],
      ch_i,
      node;

  while (index < length) {
    ch_i = exprICode(index);

    // Expressions can be separated by semicolons, commas, or just inferred without any
    // separators
    if (ch_i === SEMCOL_CODE || ch_i === COMMA_CODE) {
      index++; // ignore separators
    } else {
      // Try to gobble each expression individually
      if (node = gobbleExpression()) {
        nodes.push(node);
        // If we weren't able to find a binary expression and are out of room, then
        // the expression passed in probably has too much
      } else if (index < length) {
        (0, _utils.throwError)('Unexpected "' + exprI(index) + '"', index);
      }
    }
  }

  // If there's only one expression just try returning the expression
  if (nodes.length === 1) {
    return nodes[0];
  } else {
    return {
      type: COMPOUND,
      body: nodes
    };
  }
};

parser.registerUnary = function (op_name) {
  max_unop_len = Math.max(op_name.length, max_unop_len);
  unary_ops[op_name] = 1;
  return this;
};

parser.registerBinary = function (op_name, precedence) {
  max_binop_len = Math.max(op_name.length, max_binop_len);
  binary_ops[op_name] = precedence;
  return this;
};

parser.addLiteral = function (literal_name, literal_value) {
  literals[literal_name] = literal_value;
  return this;
};

parser.removeUnaryOp = function (op_name) {
  delete unary_ops[op_name];
  if (op_name.length === max_unop_len) {
    max_unop_len = (0, _utils.getMaxKeyLen)(unary_ops);
  }
  return this;
};

parser.removeBinaryOp = function (op_name) {
  delete binary_ops[op_name];
  if (op_name.length === max_binop_len) {
    max_binop_len = (0, _utils.getMaxKeyLen)(binary_ops);
  }
  return this;
};

parser.removeLiteral = function (literal_name) {
  delete literals[literal_name];
  return this;
};

//
var FAIL = {};
var execs = {};

execs[LITERAL] = function (x) {
  return x.value;
};

execs[UNARY_EXP] = function (node, vars) {
  var val = execWalk(node.argument, vars);
  return evals[node.operator] ? evals[node.operator](val) : FAIL;
};

execs[ARRAY_EXP] = function (node, vars) {
  var xs = [];
  for (var i = 0, l = node.elements.length; i < l; i++) {
    var x = execWalk(node.elements[i], vars);
    if (x === FAIL) return FAIL;
    xs.push(x);
  }
  return xs;
};

execs[BINARY_EXP] = execs[LOGICAL_EXP] = function (node, vars) {
  var left = execWalk(node.left, vars);
  if (left === FAIL) {
    return FAIL;
  }
  var right = execWalk(node.right, vars);
  if (right === FAIL) {
    return FAIL;
  }
  var op = node.operator;
  return evals[op] ? evals[op](left, right) : FAIL;
};

execs[IDENTIFIER] = function (node, vars) {
  if ({}.hasOwnProperty.call(vars, node.name)) {
    return vars[node.name];
  } else return FAIL;
};

execs[THIS_EXP] = function (node, vars) {
  if ({}.hasOwnProperty.call(vars, 'this')) {
    return vars['this'];
  } else return FAIL;
};

execs[CALL_EXP] = function (node, vars) {
  var callee = execWalk(node.callee, vars);
  if (callee === FAIL) return FAIL;
  if (typeof callee !== 'function') return FAIL;
  var ctx = node.callee.object ? execWalk(node.callee.object, vars) : null;
  var args = [];
  for (var i = 0, l = node.arguments.length; i < l; i++) {
    var x = execWalk(node.arguments[i], vars);
    if (x === FAIL) return FAIL;
    args.push(x);
  }
  return callee.apply(ctx, args);
};

execs[MEMBER_EXP] = function (node, vars) {
  var obj = execWalk(node.object, vars);
  // if ((obj === FAIL) || (typeof obj == 'function')) {
  //   return FAIL
  // }
  if (obj === FAIL) {
    return FAIL;
  }

  // console.log('node.property: ', node.property)
  if (node.property.type === IDENTIFIER) {
    return obj[vars[node.property.name] || node.property.name];
  }
  var prop = execWalk(node.property, vars);

  if (prop === FAIL) return FAIL;
  return obj[prop];
};

execs[CONDITIONAL_EXP] = function (node, vars) {
  var val = execWalk(node.test, vars);
  if (val === FAIL) return FAIL;
  return val ? execWalk(node.consequent, vars) : execWalk(node.alternate, vars);
};

var execWalk = function execWalk(node, vars) {
  var type = node.type;

  if (type === UNARY_EXP) {
    return execs[type](node, vars);
  }

  return execs[node.type] ? execs[node.type](node, vars) : FAIL;
};

function Formulax(source) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  // this.binaryOps = binary
  // this.unaryOps = unary
  this.functions = {};
  this.data = {};
  if (source) {
    this.source = source;
    this.formula = parser(source);
  }
}

Formulax.prototype = {
  flatten: function flatten() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return [].concat.call([], args);
  },
  parse: function parse(newSource) {
    this.source = newSource;
    this.formula = parser(newSource);
    return this;
  },
  setUnary: function setUnary(name, fn) {
    parser.registerUnary(name);
  },
  setBinary: function setBinary(name, fn) {
    parser.registerBinary(name);
  },
  setFunction: function setFunction(name, fn) {
    this.functions[name] = fn;
  },
  eval: function _eval(source, data) {
    return this.parse(source).exec(data);
  },
  exec: function exec(data) {
    return execWalk(this.formula, data);
  }
};

exports.default = new Formulax();