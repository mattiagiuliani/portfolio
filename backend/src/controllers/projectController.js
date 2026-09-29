import Project from '../models/Project.js'
import { validationResult } from 'express-validator'
import { enqueuePublication } from '../services/publicationQueue.js'
import { validateContentMedia } from '../services/media/contentMedia.js'

const queueProjectPublication = async (project, wasPublished = false) => {
  if (!project.published && !wasPublished) return { status: 'not-required' }
  return enqueuePublication({ paths: ['/'] })
}

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
    await validateContentMedia(req.body, 'project')
    const project = new Project(req.body)
    await project.save()
    const publication = await queueProjectPublication(project)
    res.status(201).json({ success: true, data: project, publication })
  } catch (err) { next(err) }
}

export const updateProject = async (req, res, next) => {
  if (sendValidationErrors(req, res)) return
  try {
    const project = await Project.findById(req.params.id)
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    const wasPublished = project.published
    await validateContentMedia(req.body, 'project')
    project.set(req.body)
    await project.save()
    const publication = await queueProjectPublication(project, wasPublished)
    res.json({ success: true, data: project, publication })
  } catch (err) { next(err) }
}

export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id)
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    const projectData = typeof project.toObject === 'function' ? project.toObject() : project
    const publication = await queueProjectPublication({ ...projectData, published: false }, project.published)
    res.json({ success: true, message: 'Project deleted', publication })
  } catch (err) { next(err) }
}

export const toggleProjectFeature = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      [{ $set: { featured: { $not: '$featured' } } }],
      { new: true, select: '_id featured published title' }
    )
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    const publication = await queueProjectPublication(project, project.published)
    res.json({ success: true, data: { _id: project._id, featured: project.featured }, publication })
  } catch (err) { next(err) }
}

export const toggleProjectPublished = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      [{ $set: { published: { $not: '$published' } } }],
      { new: true, select: '_id published title' }
    )
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    const publication = await queueProjectPublication(project, !project.published)
    res.json({ success: true, data: { _id: project._id, published: project.published }, publication })
  } catch (err) { next(err) }
}
