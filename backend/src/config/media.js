import { MediaError } from '../services/media/errors.js'

export function mediaConfig(env = process.env) {
  const maxBytes = Number(env.MEDIA_MAX_BYTES || 3 * 1024 * 1024)
  const namespace = env.MEDIA_NAMESPACE
  const providerTimeoutMs = Number(env.MEDIA_PROVIDER_TIMEOUT_MS || 15000)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 8 * 1024 * 1024
    || !Number.isSafeInteger(providerTimeoutMs) || providerTimeoutMs < 1000 || providerTimeoutMs > 60000
    || !/^portfolio\/[a-z0-9][a-z0-9_-]{0,47}$/.test(namespace || '')) {
    throw new MediaError('MEDIA_CONFIG')
  }
  return { maxBytes, namespace, providerTimeoutMs }
}
