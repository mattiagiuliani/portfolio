export const getAllowedOrigins = () =>
  (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

export const isAllowedOrigin = (origin) => getAllowedOrigins().includes(origin)
