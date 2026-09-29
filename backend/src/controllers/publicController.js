import Project from '../models/Project.js'
import Settings from '../models/Settings.js'
import { serializeContentMedia } from '../services/media/contentMedia.js'

export const getPublicProjects = async (_req, res, next) => {
  try {
    const projects = await Project.find({ published: true })
      .sort({ order: 1, createdAt: -1 })
      .lean()
    return res.json({ success: true, data: await serializeContentMedia(projects, 'project') })
  } catch (err) {
    return next(err)
  }
}

export const getPublicSettings = async (_req, res, next) => {
  try {
    const settings = await Settings.findOne({ singletonKey: 'default' }).lean()
      ?? await Settings.findOne({}).lean()
    const defaults = new Settings().toObject()
    // Unsaved defaults must have a stable public fingerprint across requests.
    delete defaults._id
    delete defaults.singletonKey
    return res.json({ success: true, data: settings ?? defaults })
  } catch (err) {
    return next(err)
  }
}
