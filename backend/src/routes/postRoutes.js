import { Router } from 'express'
import { getPosts, getPostBySlug } from '../controllers/postController.js'

const router = Router()

router.get('/', getPosts)
router.get('/:slug', getPostBySlug)
// Write operations live exclusively on /api/admin/posts (JWT-protected)

export default router
