import {
  throwError,
  getMaxKeyLen,
} from './utils'

const isProd = process.env.NODE_ENV === 'production'

const COMPOUND = isProd ? 1 : 'Compound'
const IDENTIFIER = isProd ? 2 : 'Identifier'
const MEMBER_EXP = isProd ? 3 : 'MemberExpression'
const LITERAL = isProd ? 4 : 'Literal'
const THIS_EXP = isProd ? 5 : 'ThisExpression'
const CALL_EXP = isProd ? 6 : 'CallExpression'
const UNARY_EXP = isProd ? 7 : 'UnaryExpression'
const BINARY_EXP = isProd ? 8 : 'BinaryExpression'
const LOGICAL_EXP = isProd ? 9 : 'LogicalExpression'
const CONDITIONAL_EXP = isProd ? 10 : 'ConditionalExpression'
const ARRAY_EXP = isProd ? 11 : 'ArrayExpression'

const PERIOD_CODE = 46 // '.'
const COMMA_CODE = 44 // ','
const SQUOTE_CODE = 39 // single quote
const DQUOTE_CODE = 34 // double quotes
const OPAREN_CODE = 40 // (
const CPAREN_CODE = 41 // )
const OBRACK_CODE = 91 // [
const CBRACK_CODE = 93 // ]
const QUMARK_CODE = 63 // ?
const SEMCOL_CODE = 59 // ;
const COLON_CODE = 58 // :


// Operations
//

const t = true
const OPERATOR_PLUS = '+'
const OPERATOR_MINUS = '-'
const OPERATOR_DIVISION = '/'
const OPERATOR_MULTIPLE = '*'
const OPERATOR_POW = '^'
const OPERATOR_GT = '>'
const OPERATOR_GTE = '>='
const OPERATOR_LT = '<'
const OPERATOR_LTE = '<='

const OPERATOR_NOT = '!'
const OPERATOR_BOOL = '!!'
const OPERATOR_INT = '~~'


//
const evals = {}

evals[OPERATOR_PLUS] = (a, b) => a + b
evals[OPERATOR_MINUS] = (a,b) => a - b
evals[OPERATOR_DIVISION] = (a,b) => a / b
evals[OPERATOR_MULTIPLE] = (a,b) => a * b
evals[OPERATOR_POW] = (a,b) => Math.pow(a, b)
evals[OPERATOR_GT] = (a,b) => a > b
evals[OPERATOR_GTE] = (a,b) => a >= b
evals[OPERATOR_LT] = (a,b) => a < b
evals[OPERATOR_LTE] = (a,b) => a <= b

evals[OPERATOR_NOT] = x => !x
evals[OPERATOR_BOOL] = x => !!x
evals[OPERATOR_INT] = x => ~~x


// Use a quickly-accessible map to store all of the unary operators
const unary_ops = {
  '-': 1,
  '!': 1,
  '~': 1,
  '+': 1,
}

const literals = {
  'true': true,
  'false': false,
  'null': null,
}

// Also use a map for the binary operations but set their values to their
// binary precedence for quick reference:
// see [Order of operations](http://en.wikipedia.org/wiki/Order_of_operations#Programming_language)
const binary_ops = {
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
  '%': 10,
}

let max_unop_len = getMaxKeyLen(unary_ops)
let max_binop_len = getMaxKeyLen(binary_ops)
// Literals
// ----------
// Store the values to return for the various literals we may encounter

// Except for `this`, which is special. This could be changed to something like `'self'` as well
const this_str = 'this'

// Returns the precedence of a binary operator or `0` if it isn't a binary operator
const binaryPrecedence = (op_val) => binary_ops[op_val] || 0

// Utility function (gets called from multiple places)
// Also note that `a && b` and `a || b` are *logical* expressions, not binary expressions
const createBinaryExpression = (operator, left, right) => ({
  operator, left, right,
  type: (operator === '||' || operator === '&&') ? LOGICAL_EXP : BINARY_EXP,
})

// `ch` is a character code in the next three functions
const isDecimalDigit = ch => ch >= 48 && ch <= 57

const isIdentifierStart = (ch) => (
  (ch === 36) || (ch === 95) || // `$` and `_`
  (ch >= 65 && ch <= 90) || // A...Z
  (ch >= 97 && ch <= 122) || // a...z
  (ch >= 128 && !binary_ops[String.fromCharCode(ch)]) // any non-ASCII that is not an operator
)

const isIdentifierPart = (ch, partial) => (
  (ch === 36) || (ch === 95) || // `$` and `_`
  (ch >= 65 && ch <= 90) || // A...Z
  (ch >= 97 && ch <= 122) || // a...z
  (ch >= 48 && ch <= 57) || // 0...9
  (ch >= 128 && !binary_ops[String.fromCharCode(ch)]) // any non-ASCII that is not an operator
)

const exprIBuild = expr => {
  const charAtFunc = expr.charAt
  return function (index) {
    return charAtFunc.call(expr, index)
  }
}

const exprICodeBuild = expr => {
  const charCodeAtFunc = expr.charCodeAt
  return function (index) {
    return charCodeAtFunc.call(expr, index)
  }
}

const gobbleSpaces = (expr, index) => {
  let ch = expr.charCodeAt(index)
  while (ch === 32 || ch === 9 || ch === 10 || ch === 13) { // space or tab
    ch = expr.charAt(++index)
  }
  return index
}

// Search for the operation portion of the string (e.g. `+`, `===`)
// Start by taking the longest possible binary operations (3 characters: `===`, `!==`, `>>>`)
// and move down from 3 to 2 to 1 character until a matching binary operation is found
// then, return that binary operation
const gobbleBinaryOp = (expr, index) => {
  index = gobbleSpaces(expr, index)
  let to_check = expr.substr(index, max_binop_len)
  let tc_len = to_check.length
  while (tc_len > 0) {
    if (binary_ops.hasOwnProperty(to_check)) {
      index += tc_len
      return { to_check, index }
    }
    to_check = to_check.substr(0, --tc_len)
  }
  return { index }
}

// Parsing
// -------
// `expr` is a string with the passed in expression
const parser = function (expr) {
  // const tmp = expr.split('->')
  // expr = tmp.map((e, i) => {
  //   return '('.repeat(tmp.length - i) + e + ')'
  // }).join('')

  // `index` stores the character number we are currently at while `length` is a constant
  // All of the gobbles below will modify `index` as we move along
  let index = 0

  const exprI = exprIBuild(expr)
  const exprICode = exprICodeBuild(expr)
  const { length } = expr

  // Push `index` up to the next non-space character


  // The main parsing function. Much of this code is dedicated to ternary expressions
  var gobbleExpression = function () {
      var test = gobbleBinaryExpression(),
        consequent, alternate
      index = gobbleSpaces(expr, index)
      if (exprICode(index) === QUMARK_CODE) {
      // Ternary expression: test ? consequent : alternate
        index++
        consequent = gobbleExpression()
        if (!consequent) {
          throwError('Expected expression', index)
        }
        index = gobbleSpaces(expr, index)
        if (exprICode(index) === COLON_CODE) {
          index++
          alternate = gobbleExpression()
          if (!alternate) {
            throwError('Expected expression', index)
          }
          return {
            type: CONDITIONAL_EXP,
            test,
            consequent,
            alternate,
          }
        } else {
          throwError('Expected :', index)
        }
      } else {
        return test
      }
    },

    // This function is responsible for gobbling an individual expression,
    // e.g. `1`, `1+2`, `a+(b*2)-Math.sqrt(2)`
    gobbleBinaryExpression = function () {
      var node, biop, prec, stack, biop_info, left, right, i

      // First, try to get the leftmost thing
      // Then, check to see if there's a binary operator operating on that leftmost thing
      left = gobbleToken()
      biop = gobbleBinaryOp(expr, index)
      index = biop.index

      // If there wasn't a binary operator, just return the leftmost node
      if (!biop.to_check) {
        return left
      }

      // Otherwise, we need to start a stack to properly place the binary operations in their
      // precedence structure
      biop_info = { value: biop.to_check, prec: binaryPrecedence(biop.to_check) }

      right = gobbleToken()
      if (!right) {
        throwError('Expected expression after ' + biop.to_check, index)
      }
      stack = [left, biop_info, right]

      // Properly deal with precedence using [recursive descent](http://www.engr.mun.ca/~theo/Misc/exp_parsing.htm)
      while ((biop = gobbleBinaryOp(expr, index))) {
        index = biop.index
        prec = binaryPrecedence(biop.to_check)

        if (prec === 0) {
          break
        }

        biop_info = { value: biop.to_check, prec }

        // Reduce: make a binary expression from the three topmost entries.
        while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
          right = stack.pop()
          biop = stack.pop().value
          left = stack.pop()
          node = createBinaryExpression(biop, left, right)
          stack.push(node)
        }

        node = gobbleToken()
        if (!node) {
          throwError('Expected expression after ' + biop, index)
        }
        stack.push(biop_info, node)
      }

      i = stack.length - 1
      node = stack[i]
      while (i > 1) {
        node = createBinaryExpression(stack[i - 1].value, stack[i - 2], node)
        i -= 2
      }
      return node
    },

    // An individual part of a binary expression:
    // e.g. `foo.bar(baz)`, `1`, `"abc"`, `(a % 2)` (because it's in parenthesis)
    gobbleToken = function () {
      var ch, to_check, tc_len

      index = gobbleSpaces(expr, index)
      ch = exprICode(index)

      if (isDecimalDigit(ch) || ch === PERIOD_CODE) {
        // Char code 46 is a dot `.` which can start off a numeric literal
        return gobbleNumericLiteral()
      } else if (ch === SQUOTE_CODE || ch === DQUOTE_CODE) {
        // Single or double quotes
        return gobbleStringLiteral()
      } else if (ch === OBRACK_CODE) {
        return gobbleArray()
      } else {
        to_check = expr.substr(index, max_unop_len)
        tc_len = to_check.length
        while (tc_len > 0) {
          if (unary_ops.hasOwnProperty(to_check)) {
            index += tc_len
            return {
              type: UNARY_EXP,
              operator: to_check,
              argument: gobbleToken(),
              prefix: true,
            }
          }
          to_check = to_check.substr(0, --tc_len)
        }

        if (isIdentifierStart(ch) || ch === OPAREN_CODE) { // open parenthesis
          // `foo`, `bar.baz`
          return gobbleVariable()
        }
      }

      return false
    },
    // Parse simple numeric literals: `12`, `3.4`, `.5`. Do this by using a string to
    // keep track of everything in the numeric literal and then calling `parseFloat` on that string
    gobbleNumericLiteral = function () {
      var number = '', ch, chCode
      while (isDecimalDigit(exprICode(index))) {
        number += exprI(index++)
      }

      if (exprICode(index) === PERIOD_CODE) { // can start with a decimal marker
        number += exprI(index++)

        while (isDecimalDigit(exprICode(index))) {
          number += exprI(index++)
        }
      }

      ch = exprI(index)
      if (ch === 'e' || ch === 'E') { // exponent marker
        number += exprI(index++)
        ch = exprI(index)
        if (ch === '+' || ch === '-') { // exponent sign
          number += exprI(index++)
        }
        while (isDecimalDigit(exprICode(index))) { //exponent itself
          number += exprI(index++)
        }
        if (!isDecimalDigit(exprICode(index - 1))) {
          throwError('Expected exponent (' + number + exprI(index) + ')', index)
        }
      }


      chCode = exprICode(index)
      // Check to make sure this isn't a variable name that start with a number (123abc)
      if (isIdentifierStart(chCode)) {
        throwError('Variable names cannot start with a number (' +
          number + exprI(index) + ')', index)
      } else if (chCode === PERIOD_CODE) {
        throwError('Unexpected period', index)
      }

      return {
        type: LITERAL,
        value: parseFloat(number),
        raw: number,
      }
    },

    // Parses a string literal, staring with single or double quotes with basic support for escape codes
    // e.g. `"hello world"`, `'this is\nparser'`
    gobbleStringLiteral = function () {
      var str = '', quote = exprI(index++), closed = false, ch

      while (index < length) {
        ch = exprI(index++)
        if (ch === quote) {
          closed = true
          break
        } else if (ch === '\\') {
          // Check for all of the common escape codes
          ch = exprI(index++)
          switch (ch) {
            case 'n': str += '\n'; break
            case 'r': str += '\r'; break
            case 't': str += '\t'; break
            case 'b': str += '\b'; break
            case 'f': str += '\f'; break
            case 'v': str += '\x0B'; break
            default: str += ch
          }
        } else {
          str += ch
        }
      }

      if (!closed) {
        throwError('Unclosed quote after "' + str + '"', index)
      }

      return {
        type: LITERAL,
        value: str,
        raw: quote + str + quote,
      }
    },

    // Gobbles only identifiers
    // e.g.: `foo`, `_value`, `$x1`
    // Also, this function checks if that identifier is a literal:
    // (e.g. `true`, `false`, `null`) or `this`
    gobbleIdentifier = function () {
      var ch = exprICode(index), start = index, identifier

      if (isIdentifierStart(ch)) {
        index++
      } else {
        throwError('Unexpected ' + exprI(index), index)
      }

      while (index < length) {
        ch = exprICode(index)
        if (isIdentifierPart(ch)) {
          index++
        } else {
          break
        }
      }
      identifier = expr.slice(start, index)

      if (literals.hasOwnProperty(identifier)) {
        return {
          type: LITERAL,
          value: literals[identifier],
          raw: identifier,
        }
      } else if (identifier === this_str) {
        return { type: THIS_EXP }
      } else {
        return {
          type: IDENTIFIER,
          name: identifier,
        }
      }
    },

    // Gobbles a list of arguments within the context of a function call
    // or array literal. This function also assumes that the opening character
    // `(` or `[` has already been gobbled, and gobbles expressions and commas
    // until the terminator character `)` or `]` is encountered.
    // e.g. `foo(bar, baz)`, `my_func()`, or `[bar, baz]`
    gobbleArguments = function (termination) {
      var ch_i, args = [], node, closed = false
      while (index < length) {
        index = gobbleSpaces(expr, index)
        ch_i = exprICode(index)
        if (ch_i === termination) { // done parsing
          closed = true
          index++
          break
        } else if (ch_i === COMMA_CODE) { // between expressions
          index++
        } else {
          node = gobbleExpression()
          if (!node || node.type === COMPOUND) {
            throwError('Expected comma', index)
          }
          args.push(node)
        }
      }
      if (!closed) {
        throwError('Expected ' + String.fromCharCode(termination), index)
      }
      return args
    },

    // Gobble a non-literal variable name. This variable name may include properties
    // e.g. `foo`, `bar.baz`, `foo['bar'].baz`
    // It also gobbles function calls:
    // e.g. `Math.acos(obj.angle)`
    gobbleVariable = function () {
      var ch_i, node
      ch_i = exprICode(index)

      if (ch_i === OPAREN_CODE) {
        node = gobbleGroup()
      } else {
        node = gobbleIdentifier()
      }
      index = gobbleSpaces(expr, index)
      ch_i = exprICode(index)
      while (ch_i === PERIOD_CODE || ch_i === OBRACK_CODE || ch_i === OPAREN_CODE) {
        index++
        if (ch_i === PERIOD_CODE) {
          index = gobbleSpaces(expr, index)
          node = {
            type: MEMBER_EXP,
            computed: false,
            object: node,
            property: gobbleIdentifier(),
          }
        } else if (ch_i === OBRACK_CODE) {
          node = {
            type: MEMBER_EXP,
            computed: true,
            object: node,
            property: gobbleExpression(),
          }
          index = gobbleSpaces(expr, index)
          ch_i = exprICode(index)
          if (ch_i !== CBRACK_CODE) {
            throwError('Unclosed [', index)
          }
          index++
        } else if (ch_i === OPAREN_CODE) {
          // A function call is being made; gobble all the arguments
          node = {
            type: CALL_EXP,
            'arguments': gobbleArguments(CPAREN_CODE),
            callee: node,
          }
        }
        index = gobbleSpaces(expr, index)
        ch_i = exprICode(index)
      }
      return node
    },

    // Responsible for parsing a group of things within parentheses `()`
    // This function assumes that it needs to gobble the opening parenthesis
    // and then tries to gobble everything within that parenthesis, assuming
    // that the next thing it should see is the close parenthesis. If not,
    // then the expression probably doesn't have a `)`
    gobbleGroup = function () {
      index++
      var node = gobbleExpression()
      index = gobbleSpaces(expr, index)
      if (exprICode(index) === CPAREN_CODE) {
        index++
        return node
      } else {
        throwError('Unclosed (', index)
      }
    },

    // Responsible for parsing Array literals `[1, 2, 3]`
    // This function assumes that it needs to gobble the opening bracket
    // and then tries to gobble the expressions as arguments.
    gobbleArray = function () {
      index++
      return {
        type: ARRAY_EXP,
        elements: gobbleArguments(CBRACK_CODE),
      }
    },

    nodes = [], ch_i, node


  while (index < length) {
    ch_i = exprICode(index)

    // Expressions can be separated by semicolons, commas, or just inferred without any
    // separators
    if (ch_i === SEMCOL_CODE || ch_i === COMMA_CODE) {
      index++ // ignore separators
    } else {
      // Try to gobble each expression individually
      if ((node = gobbleExpression())) {
        nodes.push(node)
        // If we weren't able to find a binary expression and are out of room, then
        // the expression passed in probably has too much
      } else if (index < length) {
        throwError('Unexpected "' + exprI(index) + '"', index)
      }
    }
  }

  // If there's only one expression just try returning the expression
  if (nodes.length === 1) {
    return nodes[0]
  } else {
    return {
      type: COMPOUND,
      body: nodes,
    }
  }
}


parser.registerUnary = function (op_name) {
  max_unop_len = Math.max(op_name.length, max_unop_len)
  unary_ops[op_name] = 1
  return this
}


parser.registerBinary = function (op_name, precedence) {
  max_binop_len = Math.max(op_name.length, max_binop_len)
  binary_ops[op_name] = precedence
  return this
}


parser.addLiteral = function (literal_name, literal_value) {
  literals[literal_name] = literal_value
  return this
}


parser.removeUnaryOp = function (op_name) {
  delete unary_ops[op_name]
  if (op_name.length === max_unop_len) {
    max_unop_len = getMaxKeyLen(unary_ops)
  }
  return this
}


parser.removeBinaryOp = function (op_name) {
  delete binary_ops[op_name]
  if (op_name.length === max_binop_len) {
    max_binop_len = getMaxKeyLen(binary_ops)
  }
  return this
}


parser.removeLiteral = function (literal_name) {
  delete literals[literal_name]
  return this
}

//
const FAIL = {}
const execs = {}

execs[LITERAL] = x => x.value

execs[UNARY_EXP] = (node, vars) => {
  const val = execWalk(node.argument, vars)
  return evals[node.operator] ? evals[node.operator](val) : FAIL
}

execs[ARRAY_EXP] = (node, vars) => {
  const xs = []
  for (let i = 0, l = node.elements.length; i < l; i++) {
    var x = execWalk(node.elements[i], vars)
    if (x === FAIL) return FAIL
    xs.push(x)
  }
  return xs
}

execs[BINARY_EXP] = execs[LOGICAL_EXP] = (node, vars) => {
  const left = execWalk(node.left, vars)
  if(left === FAIL) {
    return FAIL
  }
  const right = execWalk(node.right, vars)
  if(right === FAIL) {
    return FAIL
  }
  const op = node.operator
  return evals[op] ? evals[op](left, right) : FAIL
}

execs[IDENTIFIER] = (node, vars) => {
  if ({}.hasOwnProperty.call(vars, node.name)) {
    return vars[node.name]
  } else return FAIL
}

execs[THIS_EXP] = (node, vars) => {
  if ({}.hasOwnProperty.call(vars, 'this')) {
    return vars['this']
  } else return FAIL
}


execs[CALL_EXP] = (node, vars) => {
  const callee = execWalk(node.callee, vars)
  if (callee === FAIL) return FAIL
  if (typeof callee !== 'function') return FAIL
  const ctx = node.callee.object ? execWalk(node.callee.object, vars) : null
  const args = []
  for (var i = 0, l = node.arguments.length; i < l; i++) {
    var x = execWalk(node.arguments[i], vars)
    if (x === FAIL) return FAIL
    args.push(x)
  }
  return callee.apply(ctx, args)
}

execs[MEMBER_EXP] = (node, vars) => {
  var obj = execWalk(node.object, vars)
  // if ((obj === FAIL) || (typeof obj == 'function')) {
  //   return FAIL
  // }
  if ((obj === FAIL)) {
    return FAIL
  }

  // console.log('node.property: ', node.property)
  if (node.property.type === IDENTIFIER) {
    return obj[vars[node.property.name] || node.property.name]
  }
  const prop = execWalk(node.property, vars)

  if (prop === FAIL) return FAIL
  return obj[prop]
}

execs[CONDITIONAL_EXP] = (node, vars) => {
  var val = execWalk(node.test, vars)
  if (val === FAIL) return FAIL
  return val ? execWalk(node.consequent, vars) : execWalk(node.alternate, vars)
}

const execWalk = (node, vars) => {
  const {type} = node
  if(type === UNARY_EXP) {
    return execs[type](node, vars)
  }

  return execs[node.type]
    ? execs[node.type](node, vars)
    : FAIL
}


function Formulax(source, options = {}) {
  // this.binaryOps = binary
  // this.unaryOps = unary
  this.functions = {}
  this.data = {}
  if (source) {
    this.source = source
    this.formula = parser(source)
  }
}


Formulax.prototype = {

  flatten(...args) {
    return [].concat.call([], args)
  },

  parse(newSource) {
    this.source = newSource
    this.formula = parser(newSource)
    return this
  },

  setUnary(name, fn) {
    parser.registerUnary(name)
  },

  setBinary(name, fn) {
    parser.registerBinary(name)
  },

  setFunction(name, fn) {
    this.functions[name] = fn
  },

  eval(source, data) {
    return this.parse(source).exec(data)
  },

  exec(data) {
    return execWalk(this.formula, data)
  },


}

export default new Formulax