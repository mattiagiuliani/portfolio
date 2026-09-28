import mongoose from 'mongoose'
import MediaAsset from '../../models/MediaAsset.js'
import { MediaError } from './errors.js'

export async function registerMedia({ image, adminId, storage, config, model = MediaAsset }) {
  const id = new mongoose.Types.ObjectId()
  const key = `${config.namespace}/${id}`
  let asset
  try {
    // Persist intent before external effects, outside the publication transaction.
    asset = await model.create({ _id: id, key, provider: storage.provider, createdBy: adminId, state: 'pending' })
  } catch {
    throw new MediaError('MEDIA_DATABASE')
  }
  let stored
  try {
    stored = await storage.upload({ key, image, timeoutMs: config.providerTimeoutMs })
    const url = new URL(stored.url)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || stored.width !== image.width || stored.height !== image.height
      || stored.format !== image.format || stored.bytes !== image.bytes) throw new Error('Invalid storage result')
  } catch (error) {
    const code = error instanceof MediaError && error.code === 'MEDIA_PROVIDER_TIMEOUT' ? error.code : 'MEDIA_PROVIDER'
    try {
      await model.updateOne({ _id: id, state: 'pending' }, { $set: { state: 'failed', failureCode: code } })
    } catch { /* Pending intent remains discoverable by immutable provider key. */ }
    throw new MediaError(code)
  }
  try {
    // Copy only the public contract, never provider payload fields.
    for (const field of ['url', 'width', 'height', 'format', 'bytes']) asset[field] = stored[field]
    asset.state = 'ready'
    await asset.save()
  } catch {
    // Do not overwrite a possibly committed ready record after an ambiguous DB ack.
    throw new MediaError('MEDIA_DATABASE')
  }
  return { id: asset._id.toString(), url: asset.url, width: asset.width, height: asset.height, format: asset.format, bytes: asset.bytes }
}
