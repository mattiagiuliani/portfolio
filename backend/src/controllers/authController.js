import jwt from 'jsonwebtoken'
import Admin from '../models/Admin.js'

const COOKIE_NAME = 'admin_token'

/** Cookie options — production SPAs may be hosted on another origin. */
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
})

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Email and password are required' })
  }

  try {
    // +password overrides select:false to fetch the hashed password
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select(
      '+password'
    )

    // Use same message for missing admin and wrong password — prevents email enumeration
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    const isMatch = await admin.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' })
    }

    // Stamp last login without triggering password re-hash
    admin.lastLoginAt = new Date()
    await admin.save()

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.cookie(COOKIE_NAME, token, cookieOptions())

    res.json({
      success: true,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar ?? null,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
export const logout = (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  })
  res.json({ success: true, message: 'Logged out successfully' })
}

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id)

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    res.json({
      success: true,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar ?? null,
        lastLoginAt: admin.lastLoginAt,
      },
    })
  } catch (err) {
    next(err)
  }
}
