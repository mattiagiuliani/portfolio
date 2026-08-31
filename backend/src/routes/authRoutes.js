import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, logout, getMe } from '../controllers/authController.js'
import verifyToken from '../middleware/verifyToken.js'
import verifyOrigin from '../middleware/verifyOrigin.js'

const router = Router()

// ─── Login rate limiter — 10 attempts per 15 minutes ─────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
  skipSuccessfulRequests: true, // only count failed attempts
})

router.post('/login', loginLimiter, login)
router.post('/logout', verifyToken, verifyOrigin, logout)
router.get('/me', verifyToken, getMe)

export default router
