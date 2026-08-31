const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Reject cross-origin state-changing requests that carry the authentication cookie.
 * Browsers send Origin for fetch/XHR requests; requests without it remain supported
 * for operational clients such as curl.
 */
const verifyOrigin = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || !req.headers.origin) return next()

  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ success: false, message: 'Invalid request origin' })
  }

  return next()
}

export default verifyOrigin
import { isAllowedOrigin } from '../config/origins.js'
