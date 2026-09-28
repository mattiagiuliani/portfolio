import { createHash } from 'node:crypto'
import { MediaError } from '../media/errors.js'

// The only provider operation in this checkpoint. No browser signatures, presets,
// remote URL ingestion, deletion or arbitrary provider parameters are exposed.
export function createCloudinaryStorage({ env = process.env, fetchImpl = fetch } = {}) {
  return {
    provider: 'cloudinary',
    assertConfigured() {
      if (!/^[a-z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME || '')
        || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET
        || !/^portfolio\/[a-z0-9][a-z0-9_-]{0,47}$/.test(env.MEDIA_NAMESPACE || '')) throw new MediaError('MEDIA_CONFIG')
    },
    async upload({ key, image, timeoutMs }) {
      this.assertConfigured()
      const keyPrefix = `${env.MEDIA_NAMESPACE}/`
      if (!key.startsWith(keyPrefix) || !/^[a-f0-9]{24}$/.test(key.slice(keyPrefix.length))) {
        throw new MediaError('MEDIA_CONFIG')
      }
      const timestamp = Math.floor(Date.now() / 1000)
      const parameters = `overwrite=false&public_id=${key}&timestamp=${timestamp}`
      const form = new FormData()
      form.set('file', new Blob([image.buffer], { type: `image/${image.format}` }), `image.${image.format}`)
      form.set('public_id', key)
      form.set('overwrite', 'false')
      form.set('timestamp', String(timestamp))
      form.set('api_key', env.CLOUDINARY_API_KEY)
      form.set('signature', createHash('sha256').update(parameters + env.CLOUDINARY_API_SECRET).digest('hex'))
      const signal = AbortSignal.timeout(timeoutMs)
      try {
        const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST', body: form, signal, redirect: 'error',
        })
        if (!response.ok) {
          await response.body?.cancel()
          throw new Error('Provider rejected upload')
        }
        let size = 0
        const chunks = []
        for await (const chunk of response.body) {
          size += chunk.length
          if (size > 65536) throw new Error('Provider response too large')
          chunks.push(chunk)
        }
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const format = data.format === 'jpg' ? 'jpeg' : data.format
        const expectedUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/v${data.version}/${key}.${data.format}`
        if (data.public_id !== key || data.resource_type !== 'image' || data.type !== 'upload'
          || data.existing === true || data.overwritten === true
          || !Number.isSafeInteger(data.version) || data.version < 1 || data.secure_url !== expectedUrl
          || format !== image.format || data.width !== image.width || data.height !== image.height || data.bytes !== image.bytes) {
          throw new Error('Invalid provider metadata')
        }
        return { url: expectedUrl, width: data.width, height: data.height, format, bytes: data.bytes }
      } catch {
        throw new MediaError(signal.aborted ? 'MEDIA_PROVIDER_TIMEOUT' : 'MEDIA_PROVIDER')
      }
    },
  }
}
