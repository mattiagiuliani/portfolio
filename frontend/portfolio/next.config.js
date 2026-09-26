import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  async rewrites() {
    const api = (process.env.PORTFOLIO_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '')
    return ['auth', 'admin'].map((group) => ({
      source: `/api/${group}/:path*`,
      destination: `${api}/api/${group}/:path*`,
    }))
  },
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),
}

export default nextConfig
