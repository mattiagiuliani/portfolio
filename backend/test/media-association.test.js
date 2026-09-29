import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import Admin from '../src/models/Admin.js'
import Post from '../src/models/Post.js'
import Project from '../src/models/Project.js'
import Settings from '../src/models/Settings.js'
import MediaAsset from '../src/models/MediaAsset.js'
import PublicationJob from '../src/models/PublicationJob.js'
import { createAdminRouter } from '../src/routes/adminRoutes.js'
import postRoutes from '../src/routes/postRoutes.js'
import publicRoutes from '../src/routes/publicRoutes.js'
import errorHandler from '../src/middleware/errorHandler.js'
import { readPublicSnapshot } from '../src/services/readPublicSnapshot.js'
import { publicSnapshot } from '../src/services/publicSnapshot.js'

const origin = 'http://association.test'
const kinds = [
  { name: 'post', route: 'posts', model: Post, reference: 'coverMedia', legacy: 'coverImage', alt: 'coverAlt', local: '/images/blog/legacy.png', body: { title: 'Media post', content: 'Article body', category: 'React', published: true, featured: true } },
  { name: 'project', route: 'projects', model: Project, reference: 'imageMedia', legacy: 'image', alt: 'imageAlt', local: '/images/projects/legacy.png', body: { title: 'Media project', description: 'Project description', published: true } },
]

test('managed media association through real admin/public HTTP routes and publication transactions', { timeout: 120000 }, async (t) => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  t.after(async () => { await mongoose.disconnect(); await replica.stop() })
  await mongoose.connect(replica.getUri())
  await Promise.all([Admin, Post, Project, Settings, MediaAsset, PublicationJob].map((model) => model.init()))
  process.env.JWT_SECRET = 'association-test-only-signing-key'
  process.env.FRONTEND_ORIGIN = origin
  const admin = await Admin.create({ name: 'Private admin', email: 'association@example.test', password: 'test-only-password' })
  const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  // Provenance may refer to an old private admin; it is not a tenant ownership check.
  const previousAdmin = new mongoose.Types.ObjectId()
  const fixture = (name, values = {}) => ({
    provider: 'fixture-storage', key: `portfolio/test/${name}`, createdBy: previousAdmin,
    state: 'ready', url: `https://images.example.test/${name}.png`, width: 1200, height: 800,
    format: 'png', bytes: 1024, ...values,
  })
  const a = await MediaAsset.create(fixture('a'))
  const b = await MediaAsset.create(fixture('b', { width: 800, height: 600 }))
  const pending = await MediaAsset.create(fixture('pending', { state: 'pending' }))
  const failed = await MediaAsset.create(fixture('failed', { state: 'failed', failureCode: 'MEDIA_PROVIDER' }))
  let providerCalls = 0
  const forbidden = () => { providerCalls++; throw new Error('No provider operation during association') }
  const app = express()
  app.use(cookieParser(), express.json())
  app.use('/api/admin', createAdminRouter({ storage: { provider: 'fake', assertConfigured: forbidden, upload: forbidden, delete: forbidden } }))
  app.use('/api/posts', postRoutes)
  app.use('/api', publicRoutes)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const realFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', (url, options) => {
    assert.ok(String(url).startsWith(`${base}/`), 'association must never contact external storage')
    return realFetch(url, options)
  })
  async function api(path, { method = 'GET', body, session = token, requestOrigin = origin } = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(session ? { Cookie: `admin_token=${session}` } : {}),
      Origin: requestOrigin, 'Content-Type': 'application/json',
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.headers.get('set-cookie'), null)
    return { status: response.status, body: await response.json() }
  }
  const create = (kind, body = {}) => api(`/api/admin/${kind.route}`, { method: 'POST', body: { ...kind.body, ...body } })
  const update = (kind, id, body) => api(`/api/admin/${kind.route}/${id}`, { method: 'PUT', body })
  async function publicRecord(kind, slug = 'media-post') {
    const result = await api(kind.name === 'post' ? `/api/posts/${slug}` : '/api/projects', { session: null })
    assert.equal(result.status, 200)
    return kind.name === 'post' ? result.body.data : result.body.data[0]
  }
  const presentation = (asset, alt) => ({ url: asset.url, width: asset.width, height: asset.height, format: asset.format, alt })
  t.beforeEach(async () => {
    await Promise.all([Post.deleteMany({}), Project.deleteMany({}), PublicationJob.deleteMany({})])
  })
  t.afterEach(() => assert.equal(providerCalls, 0))

  for (const kind of kinds) {
    await t.test(`${kind.name}: ready reference stored as ID, only canonical public metadata exposed`, async () => {
      const saved = await create(kind, { [kind.reference]: a.id, [kind.alt]: 'Content-specific description' })
      assert.equal(saved.status, 201)
      assert.equal(saved.body.data[kind.reference], a.id, 'admin receives application ID')
      assert.equal(saved.body.publication.status, 'queued')
      const stored = await kind.model.findById(saved.body.data._id).lean()
      assert.equal(String(stored[kind.reference]), a.id)
      assert.equal(stored[kind.legacy], undefined, 'do not copy media URL into legacy field')
      const result = await publicRecord(kind)
      assert.deepEqual(result[kind.reference], presentation(a, 'Content-specific description'))
      assert.equal(result[kind.legacy], a.url)
      for (const forbiddenField of ['provider', 'key', 'createdBy', 'state', 'failureCode', '_id', 'id', 'bytes']) {
        assert.equal(Object.hasOwn(result[kind.reference], forbiddenField), false)
      }
      const list = await api(`/api/${kind.route}`)
      assert.deepEqual(list.body.data[0][kind.reference], result[kind.reference])
      const adminResult = await api(kind.name === 'post'
        ? `/api/admin/posts/${saved.body.data._id}`
        : '/api/admin/projects')
      const adminRecord = kind.name === 'post' ? adminResult.body.data : adminResult.body.data[0]
      assert.equal(String(adminRecord[kind.reference]), a.id)
      assert.deepEqual(adminRecord[`${kind.reference}Preview`], {
        url: a.url, width: a.width, height: a.height, format: a.format,
      })
      for (const forbiddenField of ['provider', 'key', 'createdBy', 'state', 'failureCode', '_id', 'bytes']) {
        assert.equal(Object.hasOwn(adminRecord[`${kind.reference}Preview`], forbiddenField), false)
      }
    })

    for (const [name, reference] of [
      ['nonexistent', new mongoose.Types.ObjectId().toString()], ['pending', pending.id], ['failed', failed.id],
      ['malformed', 'not-an-id'], ['empty string', ''], ['number', 123],
      ['spoofed URL', { id: a.id, url: 'https://spoof.example.test/x.png' }],
      ['spoofed dimensions', { id: a.id, width: 1, height: 1 }],
      ['spoofed format/provider', { id: a.id, format: 'svg', provider: 'other', key: 'outside' }],
    ]) {
      await t.test(`${kind.name}: ${name} association rejected on create and update without mutation/outbox`, async () => {
        const input = { [kind.reference]: reference }
        const rejected = await create(kind, input)
        assert.equal(rejected.status, 422)
        assert.equal(rejected.body.code, 'MEDIA_ASSOCIATION_INVALID')
        assert.deepEqual(rejected.body.errors, [{ field: kind.reference, message: 'Use a ready media asset ID and valid image presentation data.' }])
        assert.equal(await kind.model.countDocuments(), 0)
        assert.equal(await PublicationJob.countDocuments(), 0)
        const valid = await create(kind, { [kind.reference]: a.id })
        const before = await kind.model.findById(valid.body.data._id).lean()
        const invalidUpdate = await update(kind, valid.body.data._id, { title: 'Must not persist', ...input })
        assert.equal(invalidUpdate.status, 422)
        assert.deepEqual(await kind.model.findById(valid.body.data._id).lean(), before)
        assert.equal(await PublicationJob.countDocuments(), 1)
      })
    }

    await t.test(`${kind.name}: dotted media paths cannot bypass association validation`, async () => {
      const rejected = await create(kind, { [`${kind.reference}.url`]: a.url })
      assert.equal(rejected.status, 422)
      assert.equal(await kind.model.countDocuments(), 0)
    })

    for (const legacy of [kind.local, 'https://legacy.example.test/photo.jpg']) {
      await t.test(`${kind.name}: legacy-only ${legacy.startsWith('/') ? 'local' : 'HTTPS'} create/read/update preserved`, async () => {
        const saved = await create(kind, { [kind.legacy]: legacy })
        assert.equal(saved.status, 201)
        assert.equal((await publicRecord(kind))[kind.legacy], legacy)
        assert.equal(Object.hasOwn(await publicRecord(kind), kind.reference), false)
        assert.equal((await update(kind, saved.body.data._id, { [kind.legacy]: legacy })).status, 200)
      })
    }
    await t.test(`${kind.name}: neither image nor association remains valid`, async () => {
      assert.equal((await create(kind)).status, 201)
      const result = await publicRecord(kind)
      assert.equal(result[kind.legacy], undefined)
      assert.equal(result[kind.reference], undefined)
    })
    await t.test(`${kind.name}: managed wins; replacement and removal publish; originals and legacy stay intact`, async () => {
      const originalAssets = await MediaAsset.find().sort('_id').lean()
      const created = await create(kind, { [kind.legacy]: kind.local })
      const id = created.body.data._id
      const path = kind.name === 'post' ? '/blog/media-post' : '/'
      let revision = (await readPublicSnapshot(path)).revision
      for (const asset of [a, b, null]) {
        const saved = await update(kind, id, { [kind.reference]: asset?.id ?? null })
        assert.equal(saved.status, 200)
        const job = await PublicationJob.findById(saved.body.publication.id).lean()
        assert.equal(job.status, 'queued')
        assert.deepEqual(new Set(job.paths), new Set(kind.name === 'post' ? ['/', '/blog', '/blog/media-post'] : ['/']))
        const nextRevision = (await readPublicSnapshot(path)).revision
        assert.notEqual(nextRevision, revision)
        revision = nextRevision
        const result = await publicRecord(kind)
        assert.equal(result[kind.legacy], asset?.url ?? kind.local)
        assert.deepEqual(result[kind.reference], asset ? presentation(asset, kind.body.title) : undefined)
        const stored = await kind.model.findById(id).lean()
        assert.equal(stored[kind.legacy], kind.local)
        assert.equal(stored[kind.reference]?.toString() ?? null, asset?.id ?? null)
      }
      assert.equal(await PublicationJob.countDocuments(), 4)
      assert.deepEqual(await MediaAsset.find().sort('_id').lean(), originalAssets)
    })
    await t.test(`${kind.name}: omission preserves managed reference; null removal with no legacy leaves no image`, async () => {
      const saved = await create(kind, { [kind.reference]: a.id })
      const id = saved.body.data._id
      assert.equal((await update(kind, id, { [kind.alt]: 'Different description' })).status, 200)
      assert.equal(String((await kind.model.findById(id))[kind.reference]), a.id)
      assert.equal((await update(kind, id, { [kind.reference]: null })).status, 200)
      const result = await publicRecord(kind)
      assert.equal(result[kind.reference], undefined)
      assert.equal(result[kind.legacy], undefined)
      assert.ok(await MediaAsset.findById(a.id))
    })
    await t.test(`${kind.name}: alt belongs to content, supports empty decoration/reset, participates in snapshots`, async () => {
      const saved = await create(kind, { [kind.reference]: a.id })
      const id = saved.body.data._id
      const path = kind.name === 'post' ? '/blog/media-post' : '/'
      assert.equal((await publicRecord(kind))[kind.reference].alt, kind.body.title)
      let revision = (await readPublicSnapshot(path)).revision
      for (const alt of ['A descriptive alternative', '', null]) {
        const changed = await update(kind, id, { [kind.alt]: alt })
        assert.equal(changed.status, 200)
        assert.equal(changed.body.publication.status, 'queued')
        assert.equal((await publicRecord(kind))[kind.reference].alt, alt ?? kind.body.title)
        const next = (await readPublicSnapshot(path)).revision
        assert.notEqual(next, revision)
        revision = next
      }
      assert.equal((await update(kind, id, { [kind.alt]: { url: 'spoof' } })).status, 422)
      assert.equal((await update(kind, id, { [kind.alt]: 'a'.repeat(301) })).status, 422)
      assert.equal((await MediaAsset.findById(a.id)).get('alt'), undefined)
    })
    await t.test(`${kind.name}: flat untrusted metadata cannot override managed canonical fields`, async () => {
      const result = await create(kind, { [kind.reference]: a.id, [kind.legacy]: 'https://legacy.example.test/spoof.png',
        url: 'https://spoof.test', width: 1, height: 1, format: 'svg', provider: 'malicious', key: 'outside',
      })
      assert.equal(result.status, 201)
      const output = await publicRecord(kind)
      assert.deepEqual(output[kind.reference], presentation(a, kind.body.title))
      for (const field of ['url', 'width', 'height', 'format', 'provider', 'key']) assert.equal(output[field], undefined)
    })
    await t.test(`${kind.name}: draft association adds no publication work; publishing keeps existing flow`, async () => {
      const saved = await create(kind, { [kind.reference]: a.id, published: false })
      assert.equal(saved.status, 201)
      assert.equal(saved.body.publication.status, 'not-required')
      assert.equal(await PublicationJob.countDocuments(), 0)
      const action = kind.name === 'post' ? 'publish' : 'published'
      const published = await api(`/api/admin/${kind.route}/${saved.body.data._id}/${action}`, { method: 'PATCH', body: {} })
      assert.equal(published.status, 200)
      assert.equal(published.body.publication.status, 'queued')
      assert.deepEqual((await publicRecord(kind))[kind.reference], presentation(a, kind.body.title))
    })
    await t.test(`${kind.name}: missing/invalid auth and hostile Origin never create associations`, async () => {
      for (const [session, requestOrigin, status] of [[null, origin, 401], ['invalid', origin, 401], [token, 'https://hostile.test', 403]]) {
        const result = await api(`/api/admin/${kind.route}`, { method: 'POST', body: { ...kind.body, [kind.reference]: a.id }, session, requestOrigin })
        assert.equal(result.status, status)
      }
      assert.equal(await kind.model.countDocuments(), 0)
      assert.equal(await PublicationJob.countDocuments(), 0)
    })
    await t.test(`${kind.name}: public API has no association mutation endpoint`, async () => {
      const response = await realFetch(`${base}/api/${kind.route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...kind.body, [kind.reference]: a.id }) })
      assert.equal(response.status, 404)
      await response.text()
      assert.equal(await kind.model.countDocuments(), 0)
    })
  }

  await t.test('malformed ready metadata is rejected; invalid persisted references safely fall back', async () => {
    for (const [index, override] of [
      { url: 'http://unsafe.test/x.png' }, { url: 'https://user:password@unsafe.test/x.png' }, { url: 'https://images.test/x.png?private=value' },
      { width: 0 }, { height: 1.5 }, { width: 8193 }, { width: 6000, height: 6000 }, { format: 'svg' }, { bytes: 0 },
    ].entries()) {
      const id = new mongoose.Types.ObjectId()
      await MediaAsset.collection.insertOne({ _id: id, ...fixture(`malformed-${index}`, override) })
      for (const kind of kinds) {
        assert.equal((await create(kind, { [kind.reference]: id.toString() })).status, 422)
      }
    }
    for (const kind of kinds) {
      for (const reference of [pending._id, failed._id, new mongoose.Types.ObjectId()]) {
        await kind.model.deleteMany({})
        await kind.model.create({ ...kind.body, [kind.reference]: reference, [kind.legacy]: kind.local })
        const output = await publicRecord(kind)
        assert.equal(output[kind.reference], undefined)
        assert.equal(output[kind.legacy], kind.local)
      }
    }
  })

  await t.test('registry outage is sanitized; it cannot commit content or fabricate successful public fallback', async (st) => {
    const saved = await create(kinds[0], { coverMedia: a.id })
    const read = st.mock.method(MediaAsset, 'findById', () => { throw new Error('PRIVATE_DATABASE_DETAILS') })
    const result = await update(kinds[0], saved.body.data._id, { coverMedia: b.id })
    assert.equal(result.status, 503)
    assert.equal(result.body.code, 'MEDIA_ASSOCIATION_UNAVAILABLE')
    assert.ok(!JSON.stringify(result.body).includes('PRIVATE'))
    assert.equal(await PublicationJob.countDocuments(), 1)
    read.mock.restore()
    st.mock.method(MediaAsset, 'find', () => { throw new Error('PRIVATE_DATABASE_DETAILS') })
    const publicResult = await api('/api/posts/media-post')
    assert.equal(publicResult.status, 503)
    assert.ok(!JSON.stringify(publicResult.body).includes('PRIVATE'))
  })

  await t.test('association read and outbox share the transaction; failed outbox rolls reference and alt back', async (st) => {
    const kind = kinds[0]
    const saved = await create(kind, { coverMedia: a.id })
    const before = await Post.findById(saved.body.data._id).lean()
    const originalFind = MediaAsset.findById
    let mediaSession
    st.mock.method(MediaAsset, 'findById', function (...args) {
      mediaSession = mongoose.transactionAsyncLocalStorage.getStore()?.session
      return originalFind.apply(this, args)
    })
    st.mock.method(PublicationJob, 'create', async () => {
      assert.ok(mediaSession)
      assert.equal(mongoose.transactionAsyncLocalStorage.getStore()?.session, mediaSession)
      throw new Error('Intentional outbox failure')
    })
    const result = await update(kind, saved.body.data._id, { coverMedia: b.id, coverAlt: 'Do not persist' })
    assert.equal(result.status, 500)
    assert.deepEqual(await Post.findById(saved.body.data._id).lean(), before)
    assert.equal(await PublicationJob.countDocuments(), 1)
    assert.equal((await MediaAsset.findById(b.id)).state, 'ready')
  })

  await t.test('transient registry read preserves Mongo transaction retry without duplicate content/jobs', async (st) => {
    const original = MediaAsset.findById
    let attempts = 0
    st.mock.method(MediaAsset, 'findById', function (...args) {
      if (++attempts === 1) {
        const error = new mongoose.mongo.MongoServerError({ message: 'Transient registry read' })
        error.addErrorLabel('TransientTransactionError')
        throw error
      }
      return original.apply(this, args)
    })
    const saved = await create(kinds[1], { imageMedia: a.id })
    assert.equal(saved.status, 201)
    assert.equal(attempts, 2)
    assert.equal(await Project.countDocuments(), 1)
    assert.equal(await PublicationJob.countDocuments(), 1)
  })

  await t.test('public snapshot parity includes media presentation changes, excludes all registry internals', async () => {
    await create(kinds[0], { coverMedia: a.id, coverAlt: 'Post alt' })
    await create(kinds[1], { imageMedia: a.id, imageAlt: 'Project alt' })
    const paths = ['/', '/blog', '/blog/media-post']
    async function revisions() {
      return Promise.all(paths.map(async (path) => {
        const backend = await readPublicSnapshot(path)
        const wire = await publicSnapshot(path, async (apiPath) => (await api(apiPath)).body)
        assert.equal(backend.status, 200)
        assert.equal(backend.revision, wire.revision)
        return backend.revision
      }))
    }
    let previous = await revisions()
    // Direct metadata changes are test fixtures, not new registry mutation endpoints.
    for (const change of [{ url: 'https://images.example.test/new.png' }, { width: 1000 }, { height: 700 }, { format: 'webp' }]) {
      await MediaAsset.collection.updateOne({ _id: a._id }, { $set: change })
      const next = await revisions()
      next.forEach((revision, index) => assert.notEqual(revision, previous[index]))
      previous = next
    }
    await MediaAsset.collection.updateOne({ _id: a._id }, { $set: {
      key: 'portfolio/test/internal-change', provider: 'other-adapter', createdBy: admin._id,
      updatedAt: new Date(), failureCode: 'MEDIA_PROVIDER', bytes: 2000,
    } })
    assert.deepEqual(await revisions(), previous)
    const payload = JSON.stringify((await api('/api/posts')).body)
    assert.ok(!payload.includes('internal-change'))
    assert.ok(!payload.includes('other-adapter'))
    assert.ok(!payload.includes(a.id))
  })
})
