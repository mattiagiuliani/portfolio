import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import Project from '../src/models/Project.js'
import Post from '../src/models/Post.js'
import PublicationJob from '../src/models/PublicationJob.js'
import { publicationTransaction } from '../src/middleware/publicationTransaction.js'
import { createProject, toggleProjectFeature, deleteProject } from '../src/controllers/projectController.js'
import { toggleFeature, updatePost, togglePublish } from '../src/controllers/postController.js'
import { processPublicationJob } from '../src/services/publicationQueue.js'
import { readPublicSnapshot } from '../src/services/readPublicSnapshot.js'
import { createServer } from 'node:http'
import { once } from 'node:events'

async function invoke(handler, req) {
  let payload, failure
  await publicationTransaction(handler)(req, {
    status() { return this }, json(value) { payload = value },
  }, (error) => { failure = error })
  if (failure) throw failure
  return payload
}

test('transactional outbox, mutation coverage and restart recovery on a real local replica set', { timeout: 180000 }, async (t) => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  t.after(async () => { await mongoose.disconnect(); await replica.stop() })
  await mongoose.connect(replica.getUri())
  await Promise.all([Project.init(), Post.init(), PublicationJob.init()])

  await t.test('failed job insertion rolls back content; response is sent only after commit', async () => {
    const original = PublicationJob.create
    PublicationJob.create = async () => { throw new Error('simulated outbox failure') }
    try {
      await assert.rejects(invoke(createProject, { body: { title: 'Rollback', description: 'example', published: true } }), /outbox failure/)
      assert.equal(await Project.countDocuments({ title: 'Rollback' }), 0)
    } finally { PublicationJob.create = original }
  })

  await t.test('configuration outage still commits a durable queued job, featured and delete enqueue', async () => {
    const result = await invoke(createProject, { body: { title: 'Kept', description: 'example', published: true } })
    assert.equal(result.publication.status, 'queued')
    assert.ok(await PublicationJob.findById(result.publication.id))
    const featured = await invoke(toggleProjectFeature, { params: { id: result.data._id } })
    assert.equal(featured.publication.status, 'queued')
    const removed = await invoke(deleteProject, { params: { id: result.data._id } })
    assert.equal(removed.publication.status, 'queued')
    assert.equal(await Project.findById(result.data._id), null)
  })

  await t.test('post featured, slug change and withdrawal cover old and new public paths', async () => {
    const category = Post.schema.path('category').enumValues[0]
    const post = await Post.create({ title: 'Old title', content: 'Body', category, published: true })
    const featured = await invoke(toggleFeature, { params: { id: post._id } })
    assert.equal(featured.publication.status, 'queued')
    const changed = await invoke(updatePost, { params: { id: post._id }, body: { title: 'New title' } })
    assert.deepEqual(new Set(changed.publication.paths), new Set(['/', '/blog', '/blog/old-title', '/blog/new-title']))
    const withdrawn = await invoke(togglePublish, { params: { id: post._id } })
    assert.ok(withdrawn.publication.paths.includes('/blog/new-title'))
  })

  await t.test('expired in-flight states are recovered and network failure remains retryable', async () => {
    const original = process.env.PUBLIC_SITE_URL
    delete process.env.PUBLIC_SITE_URL
    try {
      for (const status of ['invalidated', 'warming']) {
        const job = await PublicationJob.create({ paths: ['/'], status, leaseUntil: new Date(0), leaseToken: 'dead-worker' })
        await processPublicationJob(job._id)
        const recovered = await PublicationJob.findById(job._id)
        assert.equal(recovered.status, 'retrying')
        assert.equal(recovered.leaseToken, null)
        assert.equal(recovered.attempts, 1)
      }
    } finally {
      if (original === undefined) delete process.env.PUBLIC_SITE_URL
      else process.env.PUBLIC_SITE_URL = original
    }
  })

  await t.test('worker invalidates, warms all paths and publishes the latest revision of an older article', async () => {
    const category = Post.schema.path('category').enumValues[0]
    const old = await Post.create({ title: 'Older article', content: 'Original body', category, published: true, publishedAt: new Date(0) })
    for (let i = 0; i < 10; i++) await Post.create({ title: `Recent ${i}`, content: 'Recent body', category, published: true })
    const saved = await invoke(updatePost, { params: { id: old._id }, body: { content: 'New body, same title' } })
    // Supersede the saved job before it runs: it must verify the current revision.
    await Post.findByIdAndUpdate(old._id, { content: 'Even newer body' })
    const visits = []
    let invalidations = 0
    const site = createServer(async (req, res) => {
      try {
        if (req.method === 'POST') {
          assert.equal(req.headers['x-revalidation-secret'], 'fixture-secret')
          invalidations++
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ accepted: true }))
          return
        }
        visits.push(req.url)
        const snapshot = await readPublicSnapshot(req.url)
        res.writeHead(snapshot.status, { 'Content-Type': 'text/html' })
        res.end(`<main data-public-version="${snapshot.revision}"></main>`)
      } catch { res.writeHead(500); res.end() }
    })
    site.listen(0, '127.0.0.1')
    await once(site, 'listening')
    const previous = Object.fromEntries(['PUBLIC_SITE_URL', 'FRONTEND_REVALIDATE_URL', 'REVALIDATION_SECRET'].map((key) => [key, process.env[key]]))
    process.env.PUBLIC_SITE_URL = `http://127.0.0.1:${site.address().port}`
    process.env.REVALIDATION_SECRET = 'fixture-secret'
    delete process.env.FRONTEND_REVALIDATE_URL
    try {
      await processPublicationJob(saved.publication.id)
      const job = await PublicationJob.findById(saved.publication.id)
      assert.equal(job.status, 'published', job.lastError)
      assert.equal(invalidations, 1)
      assert.deepEqual(new Set(visits), new Set(['/', '/blog', '/blog/older-article']))
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      await new Promise((resolve) => site.close(resolve))
    }
  })
})
