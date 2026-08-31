import { validationResult } from 'express-validator'
import Post from '../models/Post.js'

const PUBLIC_SORTS = new Set(['-publishedAt', 'publishedAt', '-createdAt', 'createdAt', 'title', '-title'])
const ADMIN_SORTS = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'title', '-title', 'publishedAt', '-publishedAt'])

const allowedSort = (value, allowed, fallback) => (allowed.has(value) ? value : fallback)

// ─── GET /api/posts ────────────────────────────────────────────────────────────
// Supports: ?page= ?limit= ?category= ?tag= ?featured=true ?search= ?sort=
export const getPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      tag,
      featured,
      search,
      sort: requestedSort = '-publishedAt',
    } = req.query

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10))
    const skip = (pageNum - 1) * limitNum
    const sort = allowedSort(requestedSort, PUBLIC_SORTS, '-publishedAt')

    // ─── Build filter ──────────────────────────────────────────────────────────
    const filter = { published: true }

    if (category) filter.category = category

    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag]
      filter.tags = { $in: tags }
    }

    if (featured === 'true') filter.featured = true

    // Full-text search via weighted text index (title:10, tags:5, content:1)
    if (search && search.trim()) {
      filter.$text = { $search: search.trim() }
    }

    // ─── Parallel query + count for performance ────────────────────────────────
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .select('-content')           // exclude content body from list responses
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Post.countDocuments(filter),
    ])

    const pages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: posts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/posts/:slug ──────────────────────────────────────────────────────
export const getPostBySlug = async (req, res, next) => {
  try {
    const post = await Post.findOne({
      slug: req.params.slug,
      published: true,
    }).lean()

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' })
    }

    res.json({ success: true, data: post })
  } catch (err) {
    next(err)
  }
}

// Admin editor requests the complete document; list endpoints intentionally omit content.
export const getAdminPostById = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).lean()
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' })

    return res.json({ success: true, data: post })
  } catch (err) {
    return next(err)
  }
}

// ─── POST /api/posts ───────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }

  try {
    // Use `new Post().save()` so pre-save hooks run (slug, readingTime, excerpt)
    const post = new Post(req.body)
    await post.save()

    res.status(201).json({ success: true, data: post })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A post with this slug already exists',
      })
    }
    next(err)
  }
}

// ─── PUT /api/posts/:id ────────────────────────────────────────────────────────
export const updatePost = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }

  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' })
    }

    // `set()` + `save()` ensures pre-save hooks re-run for slug/readingTime
    post.set(req.body)
    await post.save()

    res.json({ success: true, data: post })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A post with this slug already exists',
      })
    }
    next(err)
  }
}

// ─── DELETE /api/posts/:id ─────────────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id)

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' })
    }

    res.json({ success: true, message: 'Post deleted successfully' })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/posts ──────────────────────────────────────────────────────
// Admin version: returns ALL posts (drafts + published) with full filter support
export const getAdminPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      published,
      sort: requestedSort = '-createdAt',
    } = req.query

    const pageNum  = Math.max(1, parseInt(page, 10)  || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip     = (pageNum - 1) * limitNum
    const sort = allowedSort(requestedSort, ADMIN_SORTS, '-createdAt')

    const filter = {}
    // Optional published filter — if omitted, all statuses are returned
    if (published === 'true')  filter.published = true
    if (published === 'false') filter.published = false
    if (category) filter.category = category
    if (search?.trim()) filter.$text = { $search: search.trim() }

    const [posts, total] = await Promise.all([
      Post.find(filter).select('-content').sort(sort).skip(skip).limit(limitNum).lean(),
      Post.countDocuments(filter),
    ])

    const pages = Math.ceil(total / limitNum)

    res.json({
      success: true,
      data: posts,
      pagination: { total, page: pageNum, limit: limitNum, pages, hasNext: pageNum < pages, hasPrev: pageNum > 1 },
    })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/posts/:id/publish ───────────────────────────────────────
export const togglePublish = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' })

    post.published = !post.published
    // Stamp publishedAt on first publish (pre-save hook handles this too, but explicit is clearer)
    if (post.published && !post.publishedAt) post.publishedAt = new Date()
    await post.save()

    res.json({ success: true, data: { _id: post._id, published: post.published, publishedAt: post.publishedAt } })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/posts/:id/feature ───────────────────────────────────────
export const toggleFeature = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      [{ $set: { featured: { $not: '$featured' } } }], // atomic toggle
      { new: true, select: '_id featured' }
    )
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' })

    res.json({ success: true, data: { _id: post._id, featured: post.featured } })
  } catch (err) {
    next(err)
  }
}
