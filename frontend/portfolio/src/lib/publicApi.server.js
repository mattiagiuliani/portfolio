import { publicSnapshot } from './publicSnapshot.server'
import 'server-only'

const apiBaseUrl = process.env.PORTFOLIO_API_URL ?? process.env.NEXT_PUBLIC_API_URL

export class PublicApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

function getApiBaseUrl() {
  if (!apiBaseUrl) {
    throw new PublicApiError('PORTFOLIO_API_URL must be configured for server rendering')
  }
  return apiBaseUrl.replace(/\/$/, '')
}

async function getPublicJson(path, options = {}) {
  let response
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...options.headers },
    })
  } catch (error) {
    throw new PublicApiError(`Public API request failed for ${path}: ${error.message}`)
  }

  if (response.status === 404) throw new PublicApiError(`Public content not found: ${path}`, 404)
  if (!response.ok) throw new PublicApiError(`Public API request failed for ${path}`, response.status)

  const payload = await response.json()
  if (!payload?.success || !Object.hasOwn(payload, 'data')) {
    throw new PublicApiError(`Invalid public API response for ${path}`)
  }
  return payload
}

export const getPosts = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const suffix = query.size ? `?${query}` : ''
  return getPublicJson(`/api/posts${suffix}`, {
    next: { revalidate: 3600, tags: ['posts', 'blog', 'home'] },
  })
}

export const getPageSnapshot = (path) => publicSnapshot(path, (apiPath) => getPublicJson(apiPath, { next: { revalidate: 3600, tags: [`page:${path}`] } }))
