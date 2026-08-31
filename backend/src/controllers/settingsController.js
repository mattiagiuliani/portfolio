import Settings from '../models/Settings.js'
import { validationResult } from 'express-validator'

const SETTINGS_KEY = 'default'

const getSingletonSettings = async (update = {}) => {
  // Reuse one pre-singleton document before creating anything new, so existing
  // deployments retain their settings. Future writes are protected by the unique key.
  const legacy = await Settings.findOne({ singletonKey: { $exists: false } }).sort({ createdAt: 1 })
  if (legacy) {
    legacy.singletonKey = SETTINGS_KEY
    legacy.set(update)
    return legacy.save()
  }

  try {
    return await Settings.findOneAndUpdate(
      { singletonKey: SETTINGS_KEY },
      { $set: update, $setOnInsert: { singletonKey: SETTINGS_KEY } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    )
  } catch (err) {
    // A simultaneous first request may lose the unique-index race; read the
    // document created by the winner instead of returning an error.
    if (err.code === 11000) return Settings.findOne({ singletonKey: SETTINGS_KEY })
    throw err
  }
}

// Always returns exactly one document, creating defaults on first call
export const getSettings = async (req, res, next) => {
  try {
    const settings = await getSingletonSettings()
    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
}

export const updateSettings = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
    })
  }

  try {
    const settings = await getSingletonSettings(req.body)
    res.json({ success: true, data: settings })
  } catch (err) { next(err) }
}
