import { siteUrl, isPreview } from '../lib/seo'

export default function robots() {
  return {
    rules: { userAgent: '*', ...(isPreview ? { disallow: '/' } : { allow: '/', disallow: '/api/' }) },
    ...(!isPreview ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  }
}
