import mongoose from 'mongoose'

const ready = function () { return this.state === 'ready' }
const positiveInteger = { type: Number, min: 1, validate: Number.isSafeInteger, required: ready }
const mediaAssetSchema = new mongoose.Schema({
  provider: { type: String, required: true, immutable: true },
  key: { type: String, required: true, immutable: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, immutable: true },
  state: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending', required: true },
  url: { type: String, required: ready, match: /^https:\/\// },
  width: positiveInteger,
  height: positiveInteger,
  format: { type: String, enum: ['jpeg', 'png', 'webp'], required: ready },
  bytes: positiveInteger,
  // A failed attempt can still exist remotely (e.g. a lost provider response).
  // Keep its immutable key for later reconciliation; never assume it is absent.
  failureCode: { type: String, enum: ['MEDIA_PROVIDER', 'MEDIA_PROVIDER_TIMEOUT'] },
}, { timestamps: true })

export default mongoose.model('MediaAsset', mediaAssetSchema)
