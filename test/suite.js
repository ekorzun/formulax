import assert from 'assert'
import formulax from '../src'

describe(`Hello, world :)`, () => {


  it(`should return raw values`, () => {
    assert.equal(formulax.eval('1'), 1)
    assert.equal(formulax.eval('"hello"'), 'hello')
    assert.equal(formulax.eval('true'), true)
    assert.equal(formulax.eval('false'), false)
    assert.equal(formulax.eval('null'), null)
    assert.deepEqual(formulax.eval('[1,2,3]'), [1,2,3])
  })


  it(`should return object properties from data`, () => {
    assert.equal(formulax.eval('foo', {foo: 1}), 1)
    assert.equal(formulax.eval('foo.bar', { foo: {bar: 1}}), 1)
  })

  it(`should return array elements and object properties from data`, () => {
    assert.equal(formulax.eval('foo[1]', { foo: [1,2] }), 2)
    assert.equal(formulax.eval('foo[1].bar', { foo: [1, {bar: 2}] }), 2)
    assert.equal(formulax.eval('foo[x].bar', {
      foo: [1,{ bar: 2, buz: 4}],
      x: 1,
    }), 2)
    assert.equal(formulax.eval('foo[x.y].bar', { foo: [1, { bar: 2, buz: 4 }], x: {y: 1} }), 2)
  })


  it(`should perform basic binary ops`, () => {
    assert.equal(formulax.eval('2+2'), 4)
    assert.equal(formulax.eval('2+2*2'), 6)
    assert.equal(formulax.eval('2/2'), 1)
    assert.equal(formulax.eval('2-2'), 0)
    assert.equal(formulax.eval('2^3'), 8)
  })

})