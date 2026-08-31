import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import connectDB from './config/db.js'
import authRoutes  from './routes/authRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import contactRoutes from './routes/contactRoutes.js'
import postRoutes from './routes/postRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import errorHandler from './middleware/errorHandler.js'
import { corsOptions } from './config/cors.js'

// Local development uses the ignored .env.development file. Production relies
// only on environment variables injected by the hosting provider.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.development' })
}

const app = express()
const PORT = process.env.PORT || 5000

// ─── Security headers (helmet) ───────────────────────────────────────────────────────────
app.use(helmet())

// ─── CORS ───────────────────────────────────────────────────────────────────────────────────
app.use(
  cors(corsOptions)
)

// ─── Cookie parser (must be before routes) ────────────────────────────────────────────
app.use(cookieParser())

// ─── Global rate limiter (all routes) ─────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
)

// ─── Body parsing — 100kb limit accommodates markdown post content ──────────────
app.use(express.json({ limit: '100kb' }))

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/posts', postRoutes)
app.use('/api', publicRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Not found' }))

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler)

// ─── Start after DB connects ──────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
  )
})
