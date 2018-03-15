export const binary = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '/': (a, b) => a / b,
  '*': (a, b) => a * b,
  '^': (a, b) => Math.pow(a, b),
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
}

export const unary = {
  '!': a => !a,
  '!!': a => !!a,
  '~~': a => ~~a,
}
