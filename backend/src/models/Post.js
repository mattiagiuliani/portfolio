import mongoose from 'mongoose'

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = [
  'Web Development',
  'React',
  'JavaScript',
  'Backend',
  'Cloud',
  'Artificial Intelligence',
  'Quantum Computing',
  'Career',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a title into a URL-friendly slug */
function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Estimate reading time in minutes at 200 WPM (technical average) */
function estimateReadingTime(content) {
  const words = content.trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

/** Strip markdown syntax and return plain text */
function stripMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')   // fenced code blocks
    .replace(/`[^`]+`/g, ' ')           // inline code
    .replace(/!\[.*?\]\(.*?\)/g, ' ')   // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → keep text
    .replace(/[#*_~>|]/g, ' ')          // markdown symbols
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    coverImage: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: `Category must be one of: ${CATEGORIES.join(', ')}`,
      },
    },
    readingTime: {
      type: Number,
      min: 1,
    },
    published: {
      type: Boolean,
      default: false,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

// ─── Indexes ──────────────────────────────────────────────────────────────────
// slug unique index is created by the schema `unique: true` option
postSchema.index({ category: 1, published: 1 })
postSchema.index({ featured: 1, published: 1 })
postSchema.index({ publishedAt: -1 })
postSchema.index({ createdAt: -1 })
// Compound text index for full-text search
postSchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { weights: { title: 10, tags: 5, content: 1 } }
)

// ─── Pre-save hooks ───────────────────────────────────────────────────────────
postSchema.pre('save', function (next) {
  // Auto-generate slug from title if not provided or title changed without explicit slug change
  if (this.isNew && !this.slug) {
    this.slug = generateSlug(this.title)
  } else if (this.isModified('title') && !this.isModified('slug')) {
    this.slug = generateSlug(this.title)
  }

  // Recalculate reading time whenever content changes
  if (this.isNew || this.isModified('content')) {
    this.readingTime = estimateReadingTime(this.content)
  }

  // Auto-generate excerpt from content if not provided
  if ((this.isNew || this.isModified('content')) && !this.excerpt) {
    const plain = stripMarkdown(this.content)
    this.excerpt = plain.length > 160 ? `${plain.slice(0, 157)}...` : plain
  }

  // Stamp publishedAt on first publication
  if (this.isModified('published') && this.published && !this.publishedAt) {
    this.publishedAt = new Date()
  }

  next()
})

export default mongoose.model('Post', postSchema)
