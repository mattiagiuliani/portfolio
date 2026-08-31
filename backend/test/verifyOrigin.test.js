import assert from 'node:assert/strict'
import test from 'node:test'
import verifyOrigin from '../src/middleware/verifyOrigin.js'

const runMiddleware = ({ method = 'POST', origin } = {}) => new Promise((resolve) => {
  const req = { method, headers: origin ? { origin } : {} }
  const res = {
    statusCode: null,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; resolve({ nextCalled: false, res: this }) },
  }

  verifyOrigin(req, res, () => resolve({ nextCalled: true, res }))
})

test('allows safe methods and trusted mutating origins', async () => {
  process.env.FRONTEND_ORIGIN = 'https://portfolio.example'

  assert.equal((await runMiddleware({ method: 'GET', origin: 'https://evil.example' })).nextCalled, true)
  assert.equal((await runMiddleware({ origin: 'https://portfolio.example' })).nextCalled, true)
  assert.equal((await runMiddleware({ method: 'PATCH', origin: 'https://portfolio.example' })).nextCalled, true)
})

test('rejects untrusted mutating origins', async () => {
  process.env.FRONTEND_ORIGIN = 'https://portfolio.example'
  const result = await runMiddleware({ origin: 'https://evil.example' })

  assert.equal(result.nextCalled, false)
  assert.equal(result.res.statusCode, 403)
  assert.deepEqual(result.res.payload, { success: false, message: 'Invalid request origin' })
})
