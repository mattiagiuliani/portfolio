import { formatDate } from '../../lib/blogUtils'

/**
 * PostMeta — publication date, reading time, and optional tag count.
 *
 * Props:
 *  publishedAt  — ISO date string
 *  readingTime  — number (minutes)
 *  className    — additional classes
 */
function PostMeta({ publishedAt, readingTime, className = '' }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-mono text-muted ${className}`}>
      {publishedAt && (
        <span>{formatDate(publishedAt)}</span>
      )}
      {publishedAt && readingTime && (
        <span aria-hidden="true" className="text-subtle">·</span>
      )}
      {readingTime && (
        <span>{readingTime} min read</span>
      )}
    </p>
  )
}

export default PostMeta
