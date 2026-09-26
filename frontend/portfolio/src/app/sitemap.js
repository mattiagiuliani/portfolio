import { getPosts } from '../lib/publicApi.server'
import { absoluteUrl, isPreview } from '../lib/seo'

export const revalidate = 3600

export default async function sitemap() {
  if (isPreview) return []
  const entries = [{ url: absoluteUrl('/') }, { url: absoluteUrl('/blog') }]
  let page = 1
  let listing
  do {
    listing = await getPosts({ page, limit: 50 })
    for (const post of listing.data) {
      const date = post.updatedAt || post.publishedAt
      entries.push({ url: absoluteUrl(`/blog/${encodeURIComponent(post.slug)}`), ...(date && !Number.isNaN(Date.parse(date)) ? { lastModified: new Date(date) } : {}) })
    }
    page += 1
  } while (listing.pagination.hasNext)
  return entries
}
