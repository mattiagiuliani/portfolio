import Project from '../models/Project.js'
import { validationResult } from 'express-validator'

const sendValidationErrors = (req, res) => {
  const errors = validationResult(req)
  if (errors.isEmpty()) return false

  res.status(422).json({
    success: false,
    errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
  })
  return true
}

export const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({}).sort({ order: 1, createdAt: -1 }).lean()
    res.json({ success: true, data: projects })
  } catch (err) { next(err) }
}

export const createProject = async (req, res, next) => {
  if (sendValidationErrors(req, res)) return
  try {
    const project = new Project(req.body)
    await project.save()
    res.status(201).json({ success: true, data: project })
  } catch (err) { next(err) }
}

export const updateProject = async (req, res, next) => {
  if (sendValidationErrors(req, res)) return
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    project.set(req.body)
    await project.save()
    res.json({ success: true, data: project })
  } catch (err) { next(err) }
}

export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id)
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    res.json({ success: true, message: 'Project deleted' })
  } catch (err) { next(err) }
}

export const toggleProjectFeature = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      [{ $set: { featured: { $not: '$featured' } } }],
      { new: true, select: '_id featured' }
    )
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    res.json({ success: true, data: { _id: project._id, featured: project.featured } })
  } catch (err) { next(err) }
}

export const toggleProjectPublished = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      [{ $set: { published: { $not: '$published' } } }],
      { new: true, select: '_id published' }
    )
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    res.json({ success: true, data: { _id: project._id, published: project.published } })
  } catch (err) { next(err) }
}
