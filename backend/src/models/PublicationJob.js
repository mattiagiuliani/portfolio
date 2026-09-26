import mongoose from 'mongoose'

const checkSchema = new mongoose.Schema({
  path: { type: String, required: true },
  status: { type: Number, default: 200 },
  includes: { type: [String], default: [] },
  excludes: { type: [String], default: [] },
}, { _id: false })

const publicationJobSchema = new mongoose.Schema({
  paths: { type: [String], required: true },
  checks: { type: [checkSchema], default: [] },
  status: {
    type: String,
    enum: ['queued', 'invalidated', 'warming', 'published', 'retrying'],
    default: 'queued',
    index: true,
  },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  leaseToken: { type: String, default: null },
  leaseUntil: { type: Date, default: null, index: true },
  lastError: { type: String, default: '' },
  invalidatedAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
}, { timestamps: true })

publicationJobSchema.index({ status: 1, nextAttemptAt: 1 })

export default mongoose.model('PublicationJob', publicationJobSchema)