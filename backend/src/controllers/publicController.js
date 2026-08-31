import Project from '../models/Project.js'
import Settings from '../models/Settings.js'

export const getPublicProjects = async (_req, res, next) => {
  try {
    const projects = await Project.find({ published: true })
      .sort({ order: 1, createdAt: -1 })
      .lean()
    return res.json({ success: true, data: projects })
  } catch (err) {
    return next(err)
  }
}

export const getPublicSettings = async (_req, res, next) => {
  try {
    const settings = await Settings.findOne({ singletonKey: 'default' }).lean()
      ?? await Settings.findOne({}).lean()
    return res.json({ success: true, data: settings ?? new Settings().toObject() })
  } catch (err) {
    return next(err)
  }
}
