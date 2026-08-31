import { Router } from 'express'
import { getPublicProjects, getPublicSettings } from '../controllers/publicController.js'

const router = Router()
router.get('/projects', getPublicProjects)
router.get('/settings', getPublicSettings)

export default router
