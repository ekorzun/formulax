'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Formulex(source) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  this.binaryOps = require('./binaryOps').default;
  this.unaryOps = {};
  this.functions = {};
  this.data = {};
  if (source) {
    this.source = source;
    this.formula = (0, _parser2.default)(source);
  }
}

Formulex.prototype = {
  flatten: function flatten() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return [].concat.call([], args);
  },
  parse: function parse(newSource) {
    this.source = newSource;
    this.formula = (0, _parser2.default)(newSource);
    return this;
  },
  setUnary: function setUnary(name, fn) {
    this.unaryOps[name] = fn;
  },
  setBinary: function setBinary(name, fn) {
    this.binaryOps[name] = fn;
  },
  setFunction: function setFunction(name, fn) {
    this.functions[name] = fn;
  },
  eval: function _eval(source, data) {
    return this.parse(source).exec(data);
  },
  exec: function exec(data) {
    this.data = data || {};
    return this.compile(this.formula, null);
  },
  getIdentifier: function getIdentifier(expr) {
    return this.data[expr.name] !== undefined ? this.data[expr.name] : expr.name;
  },
  getFunction: function getFunction(expr, args) {
    return this.data[expr.name];
  },
  getLiteral: function getLiteral(expr) {
    return expr.value;
  },
  compileArgs: function compileArgs(args, prev) {
    var _this = this;

    return args.map(function (arg) {
      return _this.compile(arg, prev);
    });
  },
  compile: function compile(expr, prev) {
    var type = expr.type;

    console.log('type: ', type);
    return this[type](expr, prev);
  },


  // expr types
  BinaryExpression: function BinaryExpression(expr, prev) {
    var operator = expr.operator,
        left = expr.left,
        right = expr.right;

    var compliedLeft = this.compile(left, prev);
    var compiledRight = this.compile(right, prev);
    if (!this.binaryOps[operator]) {
      throw new Error('Undefined binary operator: "' + operator + '"');
    }
    return this.binaryOps[operator](compliedLeft, compiledRight, prev, this);
  },
  UnaryExpression: function UnaryExpression(expr, prev) {
    var operator = expr.operator,
        argument = expr.argument;

    var compliedArgument = this.compile(argument, prev);
    if (!this.unaryOps[operator]) {
      throw new Error('Undefined unary operator: "' + operator + '"');
    }
    return this.unaryOps[operator](compliedArgument);
  },
  Identifier: function Identifier(expr, prev) {
    return this.getIdentifier(expr);
  },
  Literal: function Literal(expr, prev) {
    return this.getLiteral(expr);
  },
  ArrayExpression: function ArrayExpression(expr, prev) {
    return this.compileArgs(expr.elements);
  },
  CallExpression: function CallExpression(expr, prev) {
    var callee = expr.callee;

    switch (callee.type) {
      case 'Identifier':
        {
          var fn = this.functions[callee.name] || this.getFunction(callee);
          if (!fn) {
            throw new Error('Undefined CallExpression ' + callee.name);
          }
          if (typeof fn !== 'function') {
            throw new Error('CallExpression ' + callee.name + ' is not a function');
          }

          var args = this.compileArgs(expr.arguments, prev);
          return fn.apply(this, args);
        }
      default:
        throw new Error('Undefined CallExpression');
    }
  },
  MemberExpression: function MemberExpression(expr, prev) {
    var object = expr.object,
        computed = expr.computed,
        property = expr.property;
    var data = this.data;

    if (!computed) {
      var obj = this.compile(object, data, prev);
      if (Array.isArray(obj)) {
        return obj.map(function (o) {
          return o[property.name];
        });
      } else {
        return obj[this.compile(property, data, prev)];
      }
    } else {
      var _obj = this.compile(object, data, prev);
      if (property.name === 'ALL') {
        return _obj;
      } else {
        return _obj[this.compile(property, data, prev)];
      }
    }
  }
};

exports.default = new Formulex();
