import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'

test('refuses to run without explicit bootstrap credentials', () => {
  const result = spawnSync(process.execPath, ['src/scripts/createAdmin.js'], {
    cwd: process.cwd(),
    env: { ...process.env, MONGODB_URI: '', ADMIN_EMAIL: '', ADMIN_PASSWORD: '' },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD must be set/)
})
