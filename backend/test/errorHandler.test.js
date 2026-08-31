import assert from 'node:assert/strict'
import test from 'node:test'
import errorHandler from '../src/middleware/errorHandler.js'

const run = (err) => {
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  errorHandler(err, {}, res, () => {})
  return res
}

test('error handler maps CastError, ValidationError and duplicate keys', () => {
  assert.equal(run({ name: 'CastError' }).statusCode, 400)
  const validation = run({ name: 'ValidationError', errors: { title: { path: 'title', message: 'Required' } } })
  assert.equal(validation.statusCode, 422)
  assert.deepEqual(validation.body.errors, [{ field: 'title', message: 'Required' }])
  assert.equal(run({ code: 11000 }).statusCode, 409)
})

test('error handler maps malformed JSON to a safe 400 response', () => {
  const res = run({ type: 'entity.parse.failed' })
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.message, 'Invalid JSON request body')
})
