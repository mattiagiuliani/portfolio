import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { isAllowedOrigin } from '../config/origins.js'
import { mediaConfig } from '../config/media.js'
import { createCloudinaryStorage } from '../services/storage/cloudinary.js'
import { readImagePart } from '../services/media/multipart.js'
import { normalizeImage } from '../services/media/image.js'
import { registerMedia } from '../services/media/register.js'
import { sendMediaError } from '../services/media/errors.js'

// Mounted ONLY beneath adminRoutes' verifyToken/adminOnly/verifyOrigin boundary.
export function createMediaRouter({ storage = createCloudinaryStorage(), getConfig = mediaConfig, model, rateMax = 10 } = {}) {
  const router = Router()
  let active = 0
  router.post('/', (req, res, next) => {
    if (!req.headers.origin || !isAllowedOrigin(req.headers.origin)) {
      return res.status(403).json({ success: false, message: 'An allowed Origin is required for media uploads.' })
    }
    return next()
  }, rateLimit({
    windowMs: 15 * 60 * 1000, limit: rateMax,
    keyGenerator: (req) => req.admin.id,
    standardHeaders: true, legacyHeaders: false,
    message: { success: false, code: 'MEDIA_RATE_LIMIT', message: 'Too many image uploads. Please try again later.' },
  }), async (req, res) => {
    res.set('Cache-Control', 'no-store')
    // A single bounded decode/upload at a time per backend process; no unbounded queue.
    if (active) return res.status(429).json({ success: false, code: 'MEDIA_BUSY', message: 'Another image upload is in progress.' })
    active++
    try {
      const config = getConfig()
      storage.assertConfigured()
      const part = await readImagePart(req, config.maxBytes)
      const image = await normalizeImage(part, config.maxBytes)
      const data = await registerMedia({ image, adminId: req.admin.id, storage, config, model })
      return res.status(201).json({ success: true, data })
    } catch (error) {
      if (req.mediaBodyRejected) {
        res.set('Connection', 'close')
        res.once('finish', () => req.socket?.destroy())
      }
      return sendMediaError(res, error)
    } finally {
      active--
    }
  })
  return router
}
