// Centralized error handler — must have 4 params for Express to recognize it
const errorHandler = (err, _req, res, _next) => {
  console.error(err.stack)

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid resource identifier' })
  }

  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      errors: Object.values(err.errors).map((error) => ({ field: error.path, message: error.message })),
    })
  }

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this value already exists' })
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON request body' })
  }

  const status = err.status || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong. Please try again.'
    : err.message

  return res.status(status).json({ success: false, message })
}

export default errorHandler
