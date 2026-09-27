import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import jwt from 'jsonwebtoken'
import Admin from '../src/models/Admin.js'
import verifyToken from '../src/middleware/verifyToken.js'
import adminOnly from '../src/middleware/adminOnly.js'
import { login, logout } from '../src/controllers/authController.js'

process.env.JWT_SECRET = 'test-secret'
const originalFindById = Admin.findById
const originalFindOne = Admin.findOne

afterEach(() => {
  Admin.findById = originalFindById
  Admin.findOne = originalFindOne
})

const response = () => ({
  statusCode: 200,
  body: null,
  cookieValue: null,
  cleared: false,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  cookie(name, value, options) { this.cookieName = name; this.cookieValue = value; this.cookieOptions = options; return this },
  clearCookie(name) { this.cleared = true; this.clearedName = name; return this },
})

const runToken = (token, admin) => new Promise((resolve) => {
  Admin.findById = () => ({ select: () => ({ lean: async () => admin }) })
  const req = { cookies: { admin_token: token } }
  const res = response()
  verifyToken(req, res, (error) => resolve({ req, res, error, next: true }))
    .then?.(() => resolve({ req, res, next: true }))
})

test('auth: login creates an HTTP-only session and logout clears it', async () => {
  const admin = {
    _id: '507f1f77bcf86cd799439011', name: 'Admin', email: 'admin@example.com', role: 'admin', isActive: true,
    comparePassword: async () => true,
    save: async () => {},
  }
  Admin.findOne = () => ({ select: async () => admin })
  const loginRes = response()
  await login({ body: { email: admin.email, password: 'password123' } }, loginRes, assert.fail)
  assert.equal(loginRes.statusCode, 200)
  assert.ok(loginRes.cookieValue)
  assert.equal(loginRes.cookieName, 'admin_token')
  assert.equal(loginRes.cookieOptions.httpOnly, true)

  const logoutRes = response()
  logout({}, logoutRes)
  assert.equal(logoutRes.cleared, true)
  assert.equal(logoutRes.clearedName, 'admin_token')
  assert.equal(logoutRes.body.success, true)
})

test('auth: expired, invalid and missing tokens are rejected without cookie mutation', async () => {
  const expired = jwt.sign({ id: 'id' }, process.env.JWT_SECRET, { expiresIn: -1 })
  for (const token of [expired, 'not-a-token', undefined]) {
    const result = await runToken(token, null)
    assert.equal(result.res.statusCode, 401)
    assert.equal(result.res.cleared, false)
    assert.equal(result.res.cookieValue, null)
    assert.equal(result.res.body.message, token ? 'Session expired. Please log in again.' : 'Authentication required')
  }
})

test('auth: disabled users are rejected and the current database role is used', async () => {
  const token = jwt.sign({ id: 'id', role: 'admin' }, process.env.JWT_SECRET)
  const disabled = await runToken(token, { _id: 'id', isActive: false, role: 'admin' })
  assert.equal(disabled.res.statusCode, 401)
  assert.equal(disabled.res.cleared, false)
  assert.equal(disabled.res.cookieValue, null)
  const missing = await runToken(token, null)
  assert.equal(missing.res.statusCode, 401)
  assert.equal(missing.res.cleared, false)
  assert.equal(missing.res.cookieValue, null)

  const changedRole = await runToken(token, { _id: 'id', isActive: true, role: 'super_admin' })
  assert.equal(changedRole.req.admin.role, 'super_admin')
  const res = response()
  adminOnly(changedRole.req, res, () => { res.next = true })
  assert.equal(res.next, true)
})
