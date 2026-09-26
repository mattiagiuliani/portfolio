import { getPublicationJobs, retryPublicationJob } from '../services/publicationQueue.js'

export const getPublicationStatus = async (_req, res, next) => {
  try {
    const jobs = await getPublicationJobs()
    return res.json({ success: true, data: jobs })
  } catch (error) {
    return next(error)
  }
}

export const retryPublication = async (req, res, next) => {
  try {
    const job = await retryPublicationJob(req.params.id)
    if (!job) return res.status(404).json({ success: false, message: 'Publication job not found' })
    return res.json({ success: true, data: job })
  } catch (error) {
    return next(error)
  }
}