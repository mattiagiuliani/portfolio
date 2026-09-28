import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from 'node:http'
import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import { crc32 } from 'node:zlib'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import sharp from 'sharp'
import Admin from '../src/models/Admin.js'
import MediaAsset from '../src/models/MediaAsset.js'
import { createAdminRouter } from '../src/routes/adminRoutes.js'
import { MediaError } from '../src/services/media/errors.js'
import { readImagePart } from '../src/services/media/multipart.js'
import { mediaConfig } from '../src/config/media.js'

const origin = 'http://portfolio.test'
const config = { namespace: 'portfolio/test', maxBytes: 4096, providerTimeoutMs: 1000 }
const fixtures = {}
for (const format of ['jpeg', 'png', 'webp']) {
  fixtures[format] = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#2468ac' } }).toFormat(format).toBuffer()
}
function multipart(buffer = fixtures.png, { filename = 'image.png', mime = 'image/png', extraFile = false, field } = {}) {
  const form = new FormData()
  if (buffer !== null) form.append('file', new Blob([buffer], { type: mime }), filename)
  if (extraFile) form.append('file', new Blob([fixtures.png], { type: 'image/png' }), 'second.png')
  if (field) form.append(field, '999')
  return form
}
function oversizedDimensions(width, height) {
  const png = Buffer.from(fixtures.png)
  png.writeUInt32BE(width, 16)
  png.writeUInt32BE(height, 20)
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29)
  return png
}

test('media: real HTTP admin boundary, processing and Mongo registry', { timeout: 120000 }, async (t) => {
  const mongo = await MongoMemoryServer.create()
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  await Promise.all([Admin.init(), MediaAsset.init()])
  process.env.JWT_SECRET = 'media-test-only-signing-key'
  process.env.FRONTEND_ORIGIN = origin
  const admin = await Admin.create({ name: 'Media test', email: 'media@example.test', password: 'fixture-password' })
  const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1h' })
  const calls = []
  let behavior
  let model = MediaAsset
  const storage = {
    provider: 'fake', assertConfigured() {},
    async upload(input) {
      calls.push(input)
      const pending = await MediaAsset.findOne({ key: input.key }).lean()
      assert.equal(pending.state, 'pending', 'durable intent must exist before provider work')
      assert.equal(mongoose.connection.transactionAsyncLocalStorage?.getStore(), undefined)
      if (behavior) return behavior(input)
      return { url: `https://media.example.test/${input.key}.${input.image.format}`, ...publicMetadata(input.image) }
    },
  }
  function publicMetadata(image) {
    return { width: image.width, height: image.height, bytes: image.bytes, format: image.format }
  }
  const repository = {
    create: (...args) => model.create(...args),
    updateOne: (...args) => model.updateOne(...args),
  }
  const app = express()
  app.use(cookieParser())
  app.use('/api/admin', createAdminRouter({ storage, getConfig: () => config, model: repository, rateMax: 1000 }))
  app.use('/limited', createAdminRouter({ storage, getConfig: () => config, rateMax: 1 }))
  app.use((_error, _req, res, _next) => res.status(500).json({ success: false }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  async function upload({ body = multipart(), session = token, requestOrigin = origin, path = '/api/admin/media', headers = {} } = {}) {
    const response = await fetch(base + path, { method: 'POST', body, headers: {
      ...(session ? { Cookie: `admin_token=${session}` } : {}),
      ...(requestOrigin ? { Origin: requestOrigin } : {}), ...headers,
    } })
    assert.equal(response.headers.get('set-cookie'), null, 'uploads must never mutate the session cookie')
    return { response, data: await response.json() }
  }
  t.beforeEach(async () => {
    calls.length = 0
    behavior = undefined
    model = MediaAsset
    await MediaAsset.deleteMany({})
  })
  for (const format of ['jpeg', 'png', 'webp']) {
    await t.test(`authenticated ${format} is decoded, uploaded and persisted`, async () => {
      const { response, data } = await upload({ body: multipart(fixtures[format], { filename: `original.${format}`, mime: `image/${format}` }) })
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(data.success, true)
      assert.deepEqual(Object.keys(data.data).sort(), ['bytes', 'format', 'height', 'id', 'url', 'width'])
      assert.equal(data.data.width, 12)
      assert.equal(data.data.height, 8)
      assert.equal(calls.length, 1)
      assert.match(calls[0].key, /^portfolio\/test\/[a-f0-9]{24}$/)
      assert.equal(calls[0].image.bytes, calls[0].image.buffer.length)
      const record = await MediaAsset.findById(data.data.id).lean()
      assert.equal(record.createdBy.toString(), admin.id)
      assert.equal(record.state, 'ready')
      assert.equal(record.url, data.data.url)
      assert.equal(record.provider, 'fake')
      assert.equal(record.key, calls[0].key)
      assert.ok(record.createdAt && record.updatedAt)
      const decoded = await sharp(calls[0].image.buffer).metadata()
      assert.equal(decoded.format, format)
      assert.equal(decoded.exif, undefined)
    })
  }
  for (const [name, session] of [
    ['missing', null], ['invalid', 'invalid'],
    ['expired', jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: -1 })],
    ['deleted admin', jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET)],
  ]) {
    await t.test(`${name} session fails before parser/provider and never clears cookie`, async () => {
      const { response } = await upload({ session, body: 'not even multipart' })
      assert.equal(response.status, 401)
      assert.equal(calls.length, 0)
      assert.equal(await MediaAsset.countDocuments(), 0)
    })
  }
  await t.test('disabled admin fails before provider', async () => {
    await Admin.updateOne({ _id: admin.id }, { isActive: false })
    try { assert.equal((await upload()).response.status, 401) }
    finally { await Admin.updateOne({ _id: admin.id }, { isActive: true }) }
    assert.equal(calls.length, 0)
  })
  await t.test('non-admin database role fails authorization', async () => {
    await Admin.collection.updateOne({ _id: admin._id }, { $set: { role: 'viewer' } })
    try { assert.equal((await upload()).response.status, 403) }
    finally { await Admin.updateOne({ _id: admin.id }, { role: 'admin' }) }
    assert.equal(calls.length, 0)
  })
  for (const requestOrigin of ['https://hostile.test', 'null', null]) {
    await t.test(`Origin ${requestOrigin} rejected with valid session`, async () => {
      assert.equal((await upload({ requestOrigin })).response.status, 403)
      assert.equal(calls.length, 0)
    })
  }
  const invalidCases = [
    ['SVG', multipart(Buffer.from('<svg/>'), { filename: 'x.svg', mime: 'image/svg+xml' }), 415],
    ['GIF', multipart(Buffer.from('GIF89a'), { filename: 'x.gif', mime: 'image/gif' }), 415],
    ['HEIC', multipart(Buffer.from('0000ftypheic'), { filename: 'x.heic', mime: 'image/heic' }), 415],
    ['PDF', multipart(Buffer.from('%PDF-1.7'), { filename: 'x.pdf', mime: 'application/pdf' }), 415],
    ['video', multipart(Buffer.from('0000ftypmp42'), { filename: 'x.mp4', mime: 'video/mp4' }), 415],
    ['HTML disguised as PNG', multipart(Buffer.from('<html>test</html>')), 415],
    ['binary', multipart(Buffer.from([0, 1, 2, 3])), 415],
    ['MIME mismatch', multipart(fixtures.png, { mime: 'image/jpeg' }), 415],
    ['extension mismatch', multipart(fixtures.png, { filename: 'x.jpg' }), 415],
    ['double extension', multipart(fixtures.png, { filename: 'x.png.html' }), 415],
    ['corrupt PNG', multipart(fixtures.png.subarray(0, 45)), 422],
    ['corrupt JPEG', multipart(fixtures.jpeg.subarray(0, fixtures.jpeg.length - 10), { filename: 'x.jpg', mime: 'image/jpeg' }), 422],
    ['oversized bytes', multipart(Buffer.alloc(config.maxBytes + 1)), 413],
    ['excessive dimension', multipart(oversizedDimensions(8193, 1)), 422],
    ['excessive pixels', multipart(oversizedDimensions(6000, 6000)), 422],
    ['missing file', multipart(null), 400],
    ['multiple files', multipart(fixtures.png, { extraFile: true }), 400],
    ['untrusted metadata field', multipart(fixtures.png, { field: 'width' }), 400],
    ['non-multipart', '{}', 400],
  ]
  for (const [name, body, status] of invalidCases) {
    await t.test(`${name} rejected before storage or registry`, async () => {
      const result = await upload({ body })
      assert.equal(result.response.status, status, JSON.stringify(result.data))
      assert.equal(calls.length, 0)
      assert.equal(await MediaAsset.countDocuments(), 0)
    })
  }
  await t.test('APNG animation control is rejected even when decoder sees a still PNG', async () => {
    const chunk = Buffer.alloc(20)
    chunk.writeUInt32BE(8)
    chunk.write('acTL', 4)
    chunk.writeUInt32BE(2, 8)
    chunk.writeUInt32BE(crc32(chunk.subarray(4, 16)), 16)
    const animated = Buffer.concat([fixtures.png.subarray(0, 33), chunk, fixtures.png.subarray(33)])
    assert.equal((await upload({ body: multipart(animated) })).response.status, 422)
    assert.equal(calls.length, 0)
  })
  await t.test('orientation is applied, EXIF removed, dimensions taken from normalized output', async () => {
    const rotated = await sharp(fixtures.jpeg).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    const { response, data } = await upload({ body: multipart(rotated, { filename: 'rotated.jpg', mime: 'image/jpeg' }) })
    assert.equal(response.status, 201)
    assert.equal(data.data.width, 8)
    assert.equal(data.data.height, 12)
    const output = await sharp(calls[0].image.buffer).metadata()
    assert.equal(output.exif, undefined)
    assert.equal(output.orientation, undefined)
  })
  await t.test('animated WebP is rejected before provider work', async () => {
    const raw = Buffer.concat([Buffer.alloc(12, 10), Buffer.alloc(12, 240)])
    const animated = await sharp(raw, { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer()
    assert.equal((await sharp(animated).metadata()).pages, 2)
    assert.equal((await upload({ body: multipart(animated, { filename: 'animated.webp', mime: 'image/webp' }) })).response.status, 422)
    assert.equal(calls.length, 0)
  })
  async function rawUpload(body, contentType) {
    return new Promise((resolve, reject) => {
      const req = request(base + '/api/admin/media', { method: 'POST', headers: {
        Origin: origin, Cookie: `admin_token=${token}`, 'Content-Type': contentType,
      } }, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }))
      })
      req.on('error', reject)
      req.write(body.subarray(0, 100))
      req.end(body.subarray(100))
    })
  }
  await t.test('chunked oversized request is bounded without Content-Length', async () => {
    const body = Buffer.concat([Buffer.from('--test\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n'), Buffer.alloc(config.maxBytes + 1), Buffer.from('\r\n--test--\r\n')])
    const result = await rawUpload(body, 'multipart/form-data; boundary=test')
    assert.equal(result.status, 413)
    assert.equal(result.headers['set-cookie'], undefined)
    assert.equal(calls.length, 0)
  })
  await t.test('truncated multipart fails without hanging', async () => {
    const result = await rawUpload(Buffer.from('--test\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\nabc'), 'multipart/form-data; boundary=test')
    assert.equal(result.status, 400)
    assert.equal(calls.length, 0)
  })
  await t.test('multipart envelope is bounded independently of file byte count', async () => {
    const result = await rawUpload(Buffer.alloc(config.maxBytes + 65537, 120), 'multipart/form-data; boundary=test')
    assert.equal(result.status, 413)
    assert.equal(calls.length, 0)
  })
  await t.test('missing multipart boundary is rejected before storage', async () => {
    assert.equal((await upload({ body: 'invalid', headers: { 'Content-Type': 'multipart/form-data' } })).response.status, 400)
    assert.equal(calls.length, 0)
  })
  for (const [name, error, status, code] of [
    ['rejection', new Error('PRIVATE_PROVIDER_DETAILS'), 502, 'MEDIA_PROVIDER'],
    ['timeout', new MediaError('MEDIA_PROVIDER_TIMEOUT'), 504, 'MEDIA_PROVIDER_TIMEOUT'],
  ]) {
    await t.test(`provider ${name} leaves failed intent, no usable asset or leaked details`, async () => {
      behavior = () => { throw error }
      const result = await upload()
      assert.equal(result.response.status, status)
      assert.equal(result.data.code, code)
      assert.equal(result.data.data, undefined)
      assert.ok(!JSON.stringify(result.data).includes('PRIVATE'))
      const record = await MediaAsset.findOne().lean()
      assert.equal(record.state, 'failed')
      assert.equal(record.failureCode, code)
      assert.equal(record.url, undefined)
    })
  }
  await t.test('malformed provider contract is rejected', async () => {
    behavior = ({ image }) => ({ ...publicMetadata(image), url: 'http://unsafe.test/x', width: 999 })
    const result = await upload()
    assert.equal(result.response.status, 502)
    assert.equal(await MediaAsset.countDocuments({ state: 'ready' }), 0)
  })
  await t.test('initial database failure performs no provider work', async () => {
    model = { create: async () => { throw new Error('PRIVATE_DB') } }
    const result = await upload()
    assert.equal(result.response.status, 503)
    assert.equal(calls.length, 0)
    assert.ok(!JSON.stringify(result.data).includes('PRIVATE'))
  })
  await t.test('provider success then DB failure preserves pending immutable key and returns no ready asset', async () => {
    model = { create: async (value) => {
      const record = await MediaAsset.create(value)
      record.save = async () => { throw new Error('PRIVATE_DB') }
      return record
    } }
    const result = await upload()
    assert.equal(result.response.status, 503)
    assert.equal(result.data.data, undefined)
    assert.equal(calls.length, 1)
    const pending = await MediaAsset.findOne().lean()
    assert.equal(pending.state, 'pending')
    assert.equal(pending.key, calls[0].key)
  })
  await t.test('provider failure plus DB failure leaves pending intent recoverable', async () => {
    model = { create: (...args) => MediaAsset.create(...args), updateOne: async () => { throw new Error('DB unavailable') } }
    behavior = () => { throw new Error('Provider unavailable') }
    assert.equal((await upload()).response.status, 502)
    assert.equal((await MediaAsset.findOne().lean()).state, 'pending')
  })
  await t.test('lost final DB acknowledgment returns failure without downgrading a committed ready record', async () => {
    model = { create: async (value) => {
      const record = await MediaAsset.create(value)
      const save = record.save.bind(record)
      record.save = async () => { await save(); throw new Error('Lost acknowledgment') }
      return record
    } }
    const result = await upload()
    assert.equal(result.response.status, 503)
    assert.equal(result.data.data, undefined)
    assert.equal((await MediaAsset.findOne().lean()).state, 'ready')
  })
  await t.test('concurrent work is bounded and capacity is released after failure', async () => {
    const entered = Promise.withResolvers()
    const release = Promise.withResolvers()
    behavior = async () => { entered.resolve(); await release.promise; throw new Error('failure') }
    const first = upload()
    await entered.promise
    const second = await upload()
    assert.equal(second.response.status, 429)
    assert.equal(second.data.code, 'MEDIA_BUSY')
    release.resolve()
    assert.equal((await first).response.status, 502)
    behavior = undefined
    assert.equal((await upload()).response.status, 201)
  })
  await t.test('rate limit counts authenticated attempts and stops provider work', async () => {
    assert.equal((await upload({ path: '/limited/media' })).response.status, 201)
    const result = await upload({ path: '/limited/media' })
    assert.equal(result.response.status, 429)
    assert.ok(result.response.headers.get('retry-after'))
    assert.equal(calls.length, 1)
  })
  await t.test('registry requires complete metadata for ready state and immutable key', async () => {
    const asset = await MediaAsset.create({ key: 'portfolio/test/immutable', provider: 'fake', createdBy: admin.id })
    asset.key = 'changed'
    await asset.save()
    assert.equal(asset.key, 'portfolio/test/immutable')
    asset.state = 'ready'
    await assert.rejects(asset.save(), { name: 'ValidationError' })
  })
})

test('media multipart slow and aborted streams release parser with sanitized errors', async () => {
  for (const abort of [false, true]) {
    const req = new PassThrough()
    req.headers = { 'content-type': 'multipart/form-data; boundary=test' }
    const parsed = readImagePart(req, 1024, 15)
    if (abort) req.emit('aborted')
    await assert.rejects(parsed, (error) => error.code === (abort ? 'MEDIA_MULTIPART' : 'MEDIA_UPLOAD_TIMEOUT'))
    req.destroy()
  }
})

test('media multipart rejection pauses the request instead of draining its remaining body', async () => {
  const req = new PassThrough()
  req.headers = { 'content-type': 'multipart/form-data; boundary=test' }
  let consumed = 0
  req.on('data', (chunk) => { consumed += chunk.length })
  const parsed = readImagePart(req, 1024, 1000)
  req.write(Buffer.from('--test\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n'))
  req.write(Buffer.alloc(2048))
  await assert.rejects(parsed, { code: 'MEDIA_TOO_LARGE' })
  const consumedAtRejection = consumed
  req.write(Buffer.alloc(1024 * 1024))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(consumed, consumedAtRejection)
  assert.equal(req.mediaBodyRejected, true)
  req.destroy()
})

test('media configuration fails closed and conservatively defaults to 3 MiB', () => {
  assert.equal(mediaConfig({ MEDIA_NAMESPACE: 'portfolio/test' }).maxBytes, 3 * 1024 * 1024)
  for (const env of [{}, { MEDIA_NAMESPACE: '../other' }, { MEDIA_NAMESPACE: 'portfolio/test', MEDIA_MAX_BYTES: '99999999' }, { MEDIA_NAMESPACE: 'portfolio/test', MEDIA_PROVIDER_TIMEOUT_MS: 'NaN' }]) {
    assert.throws(() => mediaConfig(env), { code: 'MEDIA_CONFIG' })
  }
})
