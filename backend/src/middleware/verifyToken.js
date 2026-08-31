import jwt from 'jsonwebtoken'
import Admin from '../models/Admin.js'

const COOKIE_NAME = 'admin_token'

/**
 * verifyToken — reads the JWT from the HTTP-only cookie,
 * verifies it, and attaches the decoded payload to `req.admin`.
 * Clears the cookie on failure so the client state stays consistent.
 */
const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  })
}

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME]

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: 'Authentication required' })
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    clearAuthCookie(res)
    return res
      .status(401)
      .json({ success: false, message: 'Session expired. Please log in again.' })
  }

  try {
    const admin = await Admin.findById(decoded.id).select('_id role isActive').lean()

    if (!admin || !admin.isActive) {
      clearAuthCookie(res)
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }

    req.admin = { id: admin._id.toString(), role: admin.role }
    return next()
  } catch (err) {
    return next(err)
  }
}

export default verifyToken
