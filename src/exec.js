const exec = ((expr, data = {}, prev) => {
  const { type } = expr
  if (type === 'Compound') {
    //
  } else {
    switch (type) {

      case 'BinaryExpression': {
        const { operator, left, right } = expr
        const prev = exec(left, data)
        switch (operator) {
          case '+': {
            return prev + exec(right, data, prev)
          }
          case '-': {
            return prev - exec(right, data, prev)
          }
          case '/':
            return prev / exec(right, data, prev)
          case '*':
            return multiply(prev, exec(right, data, prev))
          case '^':
            return Math.pow(prev, exec(right, data, prev))

          case '->':
          case '@':
            return exec(right, data, prev)

          case ':': {
            return 1
          }
        }
        break
      }

      case 'Identifier': {
        return data[expr.name] !== undefined
          ? data[expr.name]
          : expr.name
      }


      case 'Literal': {
        return expr.value
      }

      case 'UnaryExpression': {
        const { operator, argument } = expr
        switch (operator) {
          case '%':
            return prev * argument.value / 100
        }
        break
      }

      case 'MemberExpression': {
        const { object, computed, property } = expr
        if (!computed) {
          const obj = exec(object, data, prev)
          if (Array.isArray(obj)) {
            return obj.map(o => o[property.name])
          } else {
            return obj[exec(property, data, prev)]
          }
        } else {
          const obj = exec(object, data, prev)
          if (property.name === 'ALL') {
            return obj
          } else {
            return obj[exec(property, data, prev)]
          }
        }
        break
      }

      case 'CallExpression': {
        const { callee } = expr
        switch (callee.type) {
          case 'Identifier': {
            switch (callee.name) {
              case 'multiply':
                return multiply.apply(null, expr.arguments.map(arg => exec(arg, data)))
              case 'sum':
                return sum.apply(null, expr.arguments.map(arg => exec(arg, data)))
              case 'append': {
                return append.apply(null, [prev].concat(expr.arguments.map(arg => exec(arg, data))))
              }
            }
          }
        }
      }

    }
  }
})


export default exec