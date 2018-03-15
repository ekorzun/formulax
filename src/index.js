import parser from './parser'
import {unary, binary} from './defaultOps'

function Formulax(source, options = {}) {
  this.binaryOps = binary
  this.unaryOps = unary
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
    this.unaryOps[name] = fn
  },

  setBinary(name, fn) {
    this.binaryOps[name] = fn
    parser.registerBinary(name)
  },

  setFunction(name, fn) {
    this.functions[name] = fn
  },

  eval(source, data) {
    return this.parse(source).exec(data)
  },

  exec(data) {
    this.data = data || {}
    return this.compile(this.formula, null)
  },

  getIdentifier(expr) {
    return this.data[expr.name] !== undefined
      ? this.data[expr.name]
      : expr.name
  },

  getFunction(expr, args) {
    return this.data[expr.name]
  },

  getLiteral(expr) {
    return expr.value
  },

  compileArray(args, prev) {
    // if (prev !== undefined) {
    //   args.push(prev)
    // }
    return args.map(arg => this.compile(arg, prev))
  },

  compile(expr, prev) {
    // console.log('type: ', expr)
    const { type } = expr
    return this[type](expr, prev)
  },

  // expr types
  BinaryExpression(expr, prev) {
    const { operator, left, right } = expr
    const compliedLeft = this.compile(left, prev)
    if (!this.binaryOps[operator]) {
      throw new Error(`Undefined binary operator: "${operator}"`)
    }
    const compiledRight = this.compile(right, prev)
    return this.binaryOps[operator](compliedLeft, compiledRight, prev, this)
  },

  UnaryExpression(expr, prev) {
    const { operator, argument } = expr
    // console.log('argument: ', argument)
    const compliedArgument = this.compile(argument, prev)
    if (!this.unaryOps[operator]) {
      throw new Error(`Undefined unary operator: "${operator}"`)
    }
    return this.unaryOps[operator](compliedArgument)
  },

  Identifier(expr, prev) {
    return this.getIdentifier(expr)
  },

  Literal(expr, prev) {
    return this.getLiteral(expr)
  },

  ArrayExpression(expr, prev) {
    return this.compileArray(expr.elements)
  },

  CallExpression(expr, prev) {
    const { callee } = expr
    switch (callee.type) {
      case 'Identifier': {
        const fn = this.functions[callee.name] || this.getFunction(callee)
        if(!fn) {
          throw new Error(`Undefined CallExpression ${callee.name}`)
        }
        if(typeof fn !== 'function') {
          throw new Error(`CallExpression ${callee.name} is not a function`)
        }

        const args = this.compileArray(expr.arguments, prev)
        return fn.apply(this, args)
      }
      default:
        throw new Error(`Undefined CallExpression`)
    }
  },

  MemberExpression(expr, prev) {
    const { object, computed, property } = expr
    const {data} = this
    if (!computed) {
      const obj = this.compile(object, data, prev)
      if (Array.isArray(obj)) {
        return obj.map(o => o[property.name])
      } else {
        return obj[this.compile(property, data, prev)]
      }
    } else {
      const obj = this.compile(object, data, prev)
      if (property.name === 'ALL') {
        return obj
      } else if (property.name === 'format') {
        return 123
      }else {
        return obj[this.compile(property, data, prev)]
      }
    }
  },
}

export default new Formulax