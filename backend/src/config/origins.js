export const getAllowedOrigins = () =>
  (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

export const isAllowedOrigin = (origin) => getAllowedOrigins().includes(origin)
