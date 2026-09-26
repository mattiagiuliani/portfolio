import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '../index.css'
import { siteUrl, isPreview, defaultDescription } from '../lib/seo'

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Mattia Giuliani | Full Stack Developer', template: '%s | Mattia Giuliani' },
  description: defaultDescription,
  robots: isPreview ? { index: false, follow: false } : { index: true, follow: true },
  icons: { icon: '/brand/mg-logo.webp', apple: '/brand/mattia-profile.webp' },
}

export const viewport = { themeColor: '#05070c', colorScheme: 'dark' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
