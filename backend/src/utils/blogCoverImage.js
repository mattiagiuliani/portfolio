const LOCAL_BLOG_IMAGE = /^\/images\/blog\/[a-z0-9][a-z0-9._-]*\.(?:webp|jpe?g|png)$/i

export function isValidBlogCoverImage(value) {
  if (typeof value !== 'string') return false
  if (LOCAL_BLOG_IMAGE.test(value)) return true

  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
