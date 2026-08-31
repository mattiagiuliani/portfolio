import { useState } from 'react'
import { isValidBlogCoverImage } from '../../lib/blogCoverImage'

function BlogCoverImage({ src, alt, className = '', loading = 'lazy', onError }) {
  const [failed, setFailed] = useState(false)

  if (!src) return null

  if (failed || !isValidBlogCoverImage(src)) {
    return (
      <div
        role="img"
        aria-label={`Cover image unavailable: ${alt}`}
        className={`${className} flex items-center justify-center bg-bg/50 px-4 text-center text-xs font-mono text-muted`}
      >
        Cover image unavailable
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        setFailed(true)
        onError?.()
      }}
    />
  )
}

export default BlogCoverImage
