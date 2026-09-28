import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { createCloudinaryStorage } from '../src/services/storage/cloudinary.js'

const env = { CLOUDINARY_CLOUD_NAME: 'fixture-cloud', CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-not-a-real-secret', MEDIA_NAMESPACE: 'portfolio/test' }
const buffer = Buffer.from('already-normalized-fixture')
const image = { buffer, width: 12, height: 8, format: 'jpeg', bytes: buffer.length }
const key = 'portfolio/test/507f1f77bcf86cd799439011'
const result = {
  public_id: key, secure_url: `https://res.cloudinary.com/fixture-cloud/image/upload/v123/${key}.jpg`,
  width: 12, height: 8, format: 'jpg', bytes: image.bytes, version: 123, resource_type: 'image', type: 'upload',
  signature: 'must-not-escape', asset_id: 'internal-provider-id',
}

test('Cloudinary adapter sends signed server-only upload and returns only the storage contract', async () => {
  let calls = 0
  const storage = createCloudinaryStorage({ env, fetchImpl: async (url, options) => {
    calls++
    assert.equal(url, 'https://api.cloudinary.com/v1_1/fixture-cloud/image/upload')
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.ok(options.signal instanceof AbortSignal)
    const form = options.body
    assert.deepEqual([...form.keys()].sort(), ['api_key', 'file', 'overwrite', 'public_id', 'signature', 'timestamp'])
    assert.equal(form.get('public_id'), key)
    assert.equal(form.get('overwrite'), 'false')
    assert.equal(form.get('api_key'), env.CLOUDINARY_API_KEY)
    assert.equal(form.get('signature'), createHash('sha256').update(`overwrite=false&public_id=${key}&timestamp=${form.get('timestamp')}${env.CLOUDINARY_API_SECRET}`).digest('hex'))
    assert.deepEqual(Buffer.from(await form.get('file').arrayBuffer()), image.buffer)
    return Response.json(result)
  } })
  assert.deepEqual(await storage.upload({ key, image, timeoutMs: 1000 }), {
    url: result.secure_url, width: 12, height: 8, format: 'jpeg', bytes: image.bytes,
  })
  assert.equal(calls, 1)
})

test('Cloudinary adapter fails closed without configuration and never makes a request', () => {
  const storage = createCloudinaryStorage({ env: {}, fetchImpl: () => assert.fail('must not contact provider') })
  assert.throws(() => storage.assertConfigured(), { code: 'MEDIA_CONFIG' })
})

test('Cloudinary adapter accepts only generated keys inside its configured namespace', async () => {
  let calls = 0
  const storage = createCloudinaryStorage({ env, fetchImpl: async () => { calls++; return Response.json(result) } })
  await assert.rejects(storage.upload({ key: `portfolio/other/${key.split('/').at(-1)}`, image, timeoutMs: 1000 }), { code: 'MEDIA_CONFIG' })
  await assert.rejects(storage.upload({ key: `${env.MEDIA_NAMESPACE}/client-chosen`, image, timeoutMs: 1000 }), { code: 'MEDIA_CONFIG' })
  assert.equal(calls, 0)
})

for (const [name, fetchImpl] of [
  ['HTTP rejection', async () => new Response('PRIVATE_PROVIDER_ERROR', { status: 401 })],
  ['network failure', async () => { throw new Error('PRIVATE_NETWORK_ERROR') }],
  ['malformed JSON', async () => new Response('PRIVATE_NOT_JSON')],
  ['missing fields', async () => Response.json({})],
  ['wrong owner key', async () => Response.json({ ...result, public_id: 'another-app/asset' })],
  ['existing remote asset', async () => Response.json({ ...result, existing: true })],
  ['unexpected overwrite', async () => Response.json({ ...result, overwritten: true })],
  ['noncanonical host', async () => Response.json({ ...result, secure_url: 'https://hostile.test/image.jpg' })],
  ['insecure URL', async () => Response.json({ ...result, secure_url: result.secure_url.replace('https:', 'http:') })],
  ['query in URL', async () => Response.json({ ...result, secure_url: `${result.secure_url}?secret=PRIVATE` })],
  ['wrong dimensions', async () => Response.json({ ...result, width: 999 })],
  ['wrong format', async () => Response.json({ ...result, format: 'svg' })],
  ['wrong size', async () => Response.json({ ...result, bytes: 999 })],
  ['oversized response', async () => new Response('x'.repeat(65537))],
]) {
  test(`Cloudinary ${name} is sanitized and never returns usable metadata`, async () => {
    const storage = createCloudinaryStorage({ env, fetchImpl })
    await assert.rejects(storage.upload({ key, image, timeoutMs: 1000 }), (error) => {
      assert.equal(error.code, 'MEDIA_PROVIDER')
      assert.equal(error.status, 502)
      assert.ok(!error.message.includes('PRIVATE'))
      return true
    })
  })
}

test('Cloudinary request deadline aborts transport and returns sanitized timeout', async () => {
  const storage = createCloudinaryStorage({ env, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('Abort was not delivered')), 1000)
    signal.addEventListener('abort', () => { clearTimeout(guard); reject(signal.reason) }, { once: true })
  }) })
  await assert.rejects(storage.upload({ key, image, timeoutMs: 15 }), { code: 'MEDIA_PROVIDER_TIMEOUT', status: 504 })
})

test('Cloudinary deadline also covers a stalled response body after HTTP 200', async () => {
  const storage = createCloudinaryStorage({ env, fetchImpl: async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      const guard = setTimeout(() => controller.error(new Error('Abort was not delivered')), 1000)
      signal.addEventListener('abort', () => { clearTimeout(guard); controller.error(signal.reason) }, { once: true })
    },
  })) })
  await assert.rejects(storage.upload({ key, image, timeoutMs: 15 }), { code: 'MEDIA_PROVIDER_TIMEOUT', status: 504 })
})
