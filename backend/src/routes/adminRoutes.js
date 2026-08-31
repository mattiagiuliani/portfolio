import { Router } from 'express'
import { body }   from 'express-validator'
import verifyToken from '../middleware/verifyToken.js'
import adminOnly   from '../middleware/adminOnly.js'
import verifyOrigin from '../middleware/verifyOrigin.js'
import { getStats }                                          from '../controllers/adminController.js'
import { getMessages, markRead, markArchive, deleteMessage } from '../controllers/messageController.js'
import {
  getAdminPosts, getAdminPostById, togglePublish, toggleFeature,
  createPost, updatePost, deletePost,
}                                                            from '../controllers/postController.js'
import {
  getProjects, createProject, updateProject, deleteProject,
  toggleProjectFeature, toggleProjectPublished,
}                                                            from '../controllers/projectController.js'
import { getSettings, updateSettings }                       from '../controllers/settingsController.js'
import { CATEGORIES }                                        from '../models/Post.js'
import { isValidBlogCoverImage }                              from '../utils/blogCoverImage.js'

const router = Router()
router.use(verifyToken, adminOnly)
router.use(verifyOrigin)

// ─── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/stats', getStats)

// ─── Messages ─────────────────────────────────────────────────────────────────
router.get('/messages',               getMessages)
router.patch('/messages/:id/read',    markRead)
router.patch('/messages/:id/archive', markArchive)
router.delete('/messages/:id',        deleteMessage)

// ─── Blog ─────────────────────────────────────────────────────────────────────
const postValidators = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty')
    .isLength({ max: 200 }),
  body('content').optional().notEmpty().withMessage('Content cannot be empty'),
  body('category').optional().isIn(CATEGORIES),
  body('excerpt').optional().trim().isLength({ max: 500 }),
  body('coverImage').optional().trim().custom((value) => {
    if (value === '' || isValidBlogCoverImage(value)) return true
    throw new Error('Cover image must be an /images/blog/ path or an HTTPS URL')
  }),
  body('tags').optional().isArray(),
  body('published').optional().isBoolean(),
  body('featured').optional().isBoolean(),
]
const requireTitleContentCategory = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('content').notEmpty().withMessage('Content is required'),
  body('category').notEmpty().withMessage('Category is required').isIn(CATEGORIES),
  ...postValidators,
]

router.get('/posts',               getAdminPosts)
router.get('/posts/:id',           getAdminPostById)
router.post('/posts',              requireTitleContentCategory, createPost)
router.put('/posts/:id',           postValidators, updatePost)
router.delete('/posts/:id',        deletePost)
router.patch('/posts/:id/publish', togglePublish)
router.patch('/posts/:id/feature', toggleFeature)

// ─── Projects ─────────────────────────────────────────────────────────────────
const projectValidators = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }),
  body('description').optional().trim().notEmpty().isLength({ max: 1000 }),
  body('technologies').optional().isArray(),
  body('githubUrl').optional({ checkFalsy: true }).isURL(),
  body('liveUrl').optional({ checkFalsy: true }).isURL(),
  body('image').optional({ checkFalsy: true }).isURL(),
  body('featured').optional().isBoolean(),
  body('published').optional().isBoolean(),
  body('order').optional().isInt({ min: 0 }),
]
const requireTitleDescription = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 1000 }),
  ...projectValidators,
]

router.get('/projects',                   getProjects)
router.post('/projects',                  requireTitleDescription, createProject)
router.put('/projects/:id',               projectValidators, updateProject)
router.delete('/projects/:id',            deleteProject)
router.patch('/projects/:id/feature',     toggleProjectFeature)
router.patch('/projects/:id/published',   toggleProjectPublished)

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', getSettings)
router.put('/settings', [
  body('name').optional().trim().isLength({ max: 100 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('githubUrl').optional({ checkFalsy: true }).isURL(),
  body('linkedinUrl').optional({ checkFalsy: true }).isURL(),
  body('twitterUrl').optional({ checkFalsy: true }).isURL(),
  body('resumeUrl').optional({ checkFalsy: true }).isURL(),
], updateSettings)

export default router
