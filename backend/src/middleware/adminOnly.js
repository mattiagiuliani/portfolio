/**
 * adminOnly — authorization guard that runs after verifyToken.
 * Rejects requests from non-admin roles.
 * Add to any route that must be admin-only:
 *   router.get('/stats', verifyToken, adminOnly, getStats)
 */
const adminOnly = (req, res, next) => {
  if (!req.admin || !['admin', 'super_admin'].includes(req.admin.role)) {
    return res
      .status(403)
      .json({ success: false, message: 'Insufficient permissions' })
  }
  next()
}

export default adminOnly
