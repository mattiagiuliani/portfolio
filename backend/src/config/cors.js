import { getAllowedOrigins } from './origins.js'

const isVercelPreview = (origin) => {
  if (!origin) return false

  try {
    const url = new URL(origin)

    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('-mattiagiulianis-projects.vercel.app')
    )
  } catch {
    return false
  }
}

export const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      getAllowedOrigins().includes(origin) ||
      isVercelPreview(origin)
    ) {
      return callback(null, true)
    }

    return callback(new Error(`CORS: Origin not allowed: ${origin}`))
  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: ['Content-Type', 'Authorization'],
}