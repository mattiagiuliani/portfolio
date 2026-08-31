import Contact from '../models/Contact.js'

/** Escape user input before using it in a regex to prevent ReDoS */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── GET /api/admin/messages ───────────────────────────────────────────────────
// Supports: ?page= ?limit= ?status=unread|read|archived ?search=
export const getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query

    const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip     = (pageNum - 1) * limitNum

    const filter = {}

    if (status && ['unread', 'read', 'archived'].includes(status)) {
      filter.status = status
    }

    if (search?.trim()) {
      const q = escapeRegex(search.trim())
      filter.$or = [
        { name:    { $regex: q, $options: 'i' } },
        { email:   { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } },
      ]
    }

    const [messages, total] = await Promise.all([
      Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Contact.countDocuments(filter),
    ])

    const pages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: messages,
      pagination: { total, page: pageNum, limit: limitNum, pages, hasNext: pageNum < pages, hasPrev: pageNum > 1 },
    })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/messages/:id/read ───────────────────────────────────────
export const markRead = async (req, res, next) => {
  try {
    const msg = await Contact.findByIdAndUpdate(req.params.id, { status: 'read' }, { new: true }).lean()
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' })
    res.json({ success: true, data: msg })
  } catch (err) { next(err) }
}

// ─── PATCH /api/admin/messages/:id/archive ────────────────────────────────────
export const markArchive = async (req, res, next) => {
  try {
    const msg = await Contact.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true }).lean()
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' })
    res.json({ success: true, data: msg })
  } catch (err) { next(err) }
}

// ─── DELETE /api/admin/messages/:id ───────────────────────────────────────────
export const deleteMessage = async (req, res, next) => {
  try {
    const msg = await Contact.findByIdAndDelete(req.params.id)
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' })
    res.json({ success: true, message: 'Message deleted' })
  } catch (err) { next(err) }
}
