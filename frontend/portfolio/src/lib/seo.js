// Canonical production origin; never use the incoming Host or a preview URL.
export const siteUrl = new URL(process.env.SITE_URL || 'https://mattiagiuliani-portfolio.vercel.app').origin
export const siteName = 'Mattia Giuliani'
export const defaultDescription = 'Mattia Giuliani, Full Stack Developer. Explore React and Node.js projects, tested APIs, and notes on building software and exploring quantum computing.'
export const socialImage = '/brand/mattia-profile.webp'
export const absoluteUrl = (path) => new URL(path, `${siteUrl}/`).href
export const isPreview = process.env.VERCEL_ENV === 'preview'

export function pageMetadata({ title, description = defaultDescription, path, image = socialImage, type = 'website', publishedTime, modifiedTime }) {
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title, description, url: absoluteUrl(path), siteName,
      type, images: [{ url: absoluteUrl(image), alt: title }],
      ...(type === 'article' ? { publishedTime, modifiedTime, authors: [absoluteUrl('/')] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: [absoluteUrl(image)] },
  }
}

export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
