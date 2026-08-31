import { getAllowedOrigins } from './origins.js'

export const corsOptions = {
  origin: (origin, callback) => {
    // Requests without Origin (health checks, curl) do not need CORS headers.
    callback(null, !origin || getAllowedOrigins().includes(origin))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}
