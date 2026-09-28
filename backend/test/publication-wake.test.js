import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate as turn } from 'node:timers/promises'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import PublicationJob from '../src/models/PublicationJob.js'
import Project from '../src/models/Project.js'
import { publicationTransaction } from '../src/middleware/publicationTransaction.js'
import { enqueuePublication, startPublicationWorker, wakePublicationWorker, retryPublicationJob } from '../src/services/publicationQueue.js'

const deferred = () => Promise.withResolvers()

test('wake scheduling serializes scans, remembers busy wakes, retains polling and stops', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const scans = []
  t.mock.method(PublicationJob, 'find', () => ({ sort() { return this }, select() { return this }, limit() { return this }, lean() {
    const scan = deferred()
    scans.push(scan)
    return scan.promise
  } }))
  const stop = startPublicationWorker()
  t.after(stop)
  assert.equal(scans.length, 1, 'startup scans immediately')
  for (let i = 0; i < 10; i++) wakePublicationWorker()
  assert.equal(scans.length, 1, 'busy wakes do not overlap')
  scans[0].resolve([])
  await turn()
  assert.equal(scans.length, 2, 'busy wakes coalesce into another scan')
  scans[1].resolve([])
  await turn()
  assert.equal(scans.length, 2)
  wakePublicationWorker()
  assert.equal(scans.length, 3, 'idle wake scans without advancing time')
  scans[2].resolve([])
  await turn()
  t.mock.timers.tick(15000)
  assert.equal(scans.length, 4, 'periodic fallback scans without a wake')
  wakePublicationWorker()
  stop()
  scans[3].resolve([])
  await turn()
  wakePublicationWorker()
  t.mock.timers.tick(15000)
  assert.equal(scans.length, 4, 'shutdown drops pending wakes and interval')
})

test('real committed outbox wakes existing lease/verification path; rollback and manual retry', { timeout: 60000 }, async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  let stop
  t.after(async () => { stop?.(); await mongoose.disconnect(); await replica.stop() })
  await mongoose.connect(replica.getUri())
  await Promise.all([Project.init(), PublicationJob.init()])
  const scanned = deferred()
  const originalExec = mongoose.Query.prototype.exec
  let scanCount = 0
  t.mock.method(mongoose.Query.prototype, 'exec', async function (...args) {
    const result = await originalExec.apply(this, args)
    if (this.model === PublicationJob && this.op === 'find' && this.getFilter().nextAttemptAt) {
      scanCount++
      scanned.resolve()
    }
    return result
  })
  // No real network; hold verification to prove the HTTP response does not wait.
  const verification = deferred()
  const requested = deferred()
  const published = deferred()
  const originalUpdate = PublicationJob.updateOne.bind(PublicationJob)
  t.mock.method(PublicationJob, 'updateOne', async (...args) => {
    const result = await originalUpdate(...args)
    if (args[1].$set?.status === 'published') published.resolve()
    return result
  })
  const previous = { ...process.env }
  process.env.PUBLIC_SITE_URL = 'http://publication.test'
  process.env.REVALIDATION_SECRET = 'test-only'
  delete process.env.FRONTEND_REVALIDATE_URL
  t.after(() => {
    for (const key of ['PUBLIC_SITE_URL', 'REVALIDATION_SECRET', 'FRONTEND_REVALIDATE_URL']) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'POST') {
      requested.resolve()
      await verification.promise
      return Response.json({ accepted: true })
    }
    // A withdrawn article must be verified as 404 before publication completes.
    return new Response('', { status: 404 })
  })
  stop = startPublicationWorker()
  await scanned.promise
  await turn()
  const invoke = async (handler) => {
    let payload, failure
    await publicationTransaction(handler)({}, {
      status() { return this }, json(value) { payload = value },
    }, (error) => { failure = error })
    if (failure) throw failure
    return payload
  }
  for (const viaNext of [false, true]) {
    await assert.rejects(invoke(async (_req, res, next) => {
      await Project.create({ title: 'Rolled back', description: 'fixture', published: true })
      const publication = await enqueuePublication({ paths: ['/blog/missing'] })
      res.json({ publication })
      if (viaNext) next(new Error('abort'))
      else throw new Error('abort')
    }), /abort/)
  }
  await invoke(async (_req, res) => res.json({ publication: { status: 'not-required' } }))
  assert.equal(await Project.countDocuments(), 0)
  assert.equal(await PublicationJob.countDocuments(), 0)
  assert.equal(scanCount, 1, 'aborts and no-job transactions do not wake')
  const payload = await invoke(async (_req, res) => {
    const publication = await enqueuePublication({ paths: ['/blog/missing'] })
    assert.equal(scanCount, 1, 'no wake inside transaction')
    res.json({ publication })
  })
  await requested.promise
  let job = await PublicationJob.findById(payload.publication.id)
  assert.equal(job.attempts, 1)
  assert.ok(job.leaseToken)
  assert.notEqual(job.status, 'published', 'response returned while verification is held')
  verification.resolve()
  await published.promise
  await turn()
  job = await PublicationJob.findById(job._id)
  assert.equal(job.status, 'published')
  assert.equal(job.leaseToken, null)

  const retried = deferred()
  t.mock.method(globalThis, 'fetch', async () => { retried.resolve(); throw new Error('temporary outage') })
  const retryWritten = deferred()
  t.mock.method(PublicationJob, 'updateOne', async (...args) => {
    const result = await originalUpdate(...args)
    if (args[1].$set?.status === 'retrying') retryWritten.resolve()
    return result
  })
  const retryJob = await PublicationJob.create({ paths: ['/blog/missing'], status: 'retrying', nextAttemptAt: new Date(Date.now() + 60000) })
  await retryPublicationJob(retryJob._id)
  await retried.promise
  await retryWritten.promise
  const failed = await PublicationJob.findById(retryJob._id)
  assert.equal(failed.status, 'retrying')
  assert.equal(failed.attempts, 1)
  assert.equal(failed.leaseToken, null)
  assert.ok(failed.nextAttemptAt > new Date(), 'existing backoff remains active')
  await turn()

  const fallbackDone = deferred()
  const externalJob = await PublicationJob.create({ paths: ['/blog/missing'] })
  t.mock.method(PublicationJob, 'updateOne', async (...args) => {
    const result = await originalUpdate(...args)
    if (String(args[0]._id) === String(externalJob._id) && args[1].$set?.status === 'retrying') fallbackDone.resolve()
    return result
  })
  assert.equal((await PublicationJob.findById(externalJob._id)).attempts, 0)
  t.mock.timers.tick(15000)
  await fallbackDone.promise
  assert.equal((await PublicationJob.findById(externalJob._id)).attempts, 1, 'polling processes a job inserted without any local wake')
  await turn()
})
