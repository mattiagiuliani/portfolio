import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { claimableFilter, verifySnapshot, warmPaths } from '../src/services/publicationQueue.js'
import { fingerprint } from '../src/services/publicSnapshot.js'

test('public snapshot contract is identical in both independently deployed apps', async () => {
  const backend = await readFile(new URL('../src/services/publicSnapshot.js', import.meta.url), 'utf8')
  const frontend = await readFile(new URL('../../frontend/portfolio/src/lib/publicSnapshot.server.js', import.meta.url), 'utf8')
  assert.equal(backend, frontend)
})

test('description-only edits change revision; property order does not', () => {
  const before = fingerprint({ title: 'Same', description: 'old' })
  assert.equal(before, fingerprint({ description: 'old', title: 'Same' }))
  assert.notEqual(before, fingerprint({ title: 'Same', description: 'new' }))
  assert.throws(() => verifySnapshot({ status: 200, body: `<h1>Same</h1><main data-public-version="${before}">` }, { status: 200, revision: fingerprint({ title: 'Same', description: 'new' }) }, '/'))
})

test('expired invalidated/warming jobs are eligible for recovery', () => {
  const filter = claimableFilter(new Date(0))
  assert.deepEqual(filter.status.$in, ['queued', 'retrying', 'invalidated', 'warming'])
  assert.equal(filter.$or[1].leaseUntil.$lte.getTime(), 0)
})

test('warm-up verifies every affected path including homepage and withdrawn slug', async () => {
  const visited = []
  const paths = ['/', '/blog', '/blog/old', '/blog/new']
  await warmPaths(paths, {
    snapshot: async (path) => ({ status: path === '/blog/old' ? 404 : 200, revision: path === '/blog/old' ? null : 'abc' }),
    fetchPage: async (path) => {
      visited.push(path)
      return { status: path === '/blog/old' ? 404 : 200, body: '<main data-public-version="abc">' }
    },
  })
  assert.deepEqual(visited, paths)
})

test('concurrent edit during warm-up is retried instead of marked published', async () => {
  let reads = 0
  await assert.rejects(warmPaths(['/'], {
    snapshot: async () => ({ status: 200, revision: ++reads === 1 ? 'before' : 'after' }),
    fetchPage: async () => ({ status: 200, body: '<main data-public-version="before">' }),
  }), /Content changed/)
})
