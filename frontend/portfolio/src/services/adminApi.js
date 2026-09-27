import { getAuthGeneration, isCurrentAuthGeneration } from './authGeneration.js'
import { runAuthTransition } from './authTransition.js'

// Next proxies these routes to Express; cookies stay first-party on every browser.
const BASE_URL = ''

/**
 * Core fetch wrapper for all admin API calls.
 * - Sends HTTP-only cookie automatically via credentials: 'include'
 * - Throws the parsed JSON body on non-2xx responses for unified error handling
 */
async function request(path, options = {}, generation = getAuthGeneration()) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // required to send/receive the HTTP-only JWT cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const json = await res.json().catch(() => ({ message: `Request failed (${res.status}). Please try again.` }))
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login' &&
        isCurrentAuthGeneration(generation) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin-session-expired', { detail: { generation } }))
    }
    throw { ...json, status: res.status }
  }
  if (json.publication && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('publication-updated'))
  }
  return json
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (email, password) =>
    authRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => authRequest('/api/auth/logout', { method: 'POST' }),
  getMe:  () => request('/api/auth/me'),
}

function authRequest(path, options) {
  // Queueing must not give an older operation a newer transition's authority.
  const generation = getAuthGeneration()
  return runAuthTransition(() => request(path, options, generation))
}

// ─── Messages ─────────────────────────────────────────────────────────────────
// Implemented in Module 3 — Message Management
export const messagesApi = {
  getAll:  (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/admin/messages${qs ? `?${qs}` : ''}`)
  },
  markRead:   (id) => request(`/api/admin/messages/${id}/read`,    { method: 'PATCH' }),
  archive:    (id) => request(`/api/admin/messages/${id}/archive`, { method: 'PATCH' }),
  remove:     (id) => request(`/api/admin/messages/${id}`,         { method: 'DELETE' }),
}

// ─── Blog admin ───────────────────────────────────────────────────────────────
export const blogAdminApi = {
  getAll:         (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/admin/posts${qs ? `?${qs}` : ''}`)
  },
  getById:        (id)       => request(`/api/admin/posts/${id}`),
  create:         (data)     => request('/api/admin/posts',               { method: 'POST',   body: JSON.stringify(data) }),
  update:         (id, data) => request(`/api/admin/posts/${id}`,         { method: 'PUT',    body: JSON.stringify(data) }),
  remove:         (id)       => request(`/api/admin/posts/${id}`,         { method: 'DELETE' }),
  togglePublish:  (id)       => request(`/api/admin/posts/${id}/publish`, { method: 'PATCH' }),
  toggleFeature:  (id)       => request(`/api/admin/posts/${id}/feature`, { method: 'PATCH' }),
}

// ─── Projects admin ───────────────────────────────────────────────────────────
export const projectsApi = {
  getAll:           ()         => request('/api/admin/projects'),
  create:           (data)     => request('/api/admin/projects',               { method: 'POST',   body: JSON.stringify(data) }),
  update:           (id, data) => request(`/api/admin/projects/${id}`,         { method: 'PUT',    body: JSON.stringify(data) }),
  remove:           (id)       => request(`/api/admin/projects/${id}`,         { method: 'DELETE' }),
  toggleFeature:    (id)       => request(`/api/admin/projects/${id}/feature`, { method: 'PATCH' }),
  togglePublished:  (id)       => request(`/api/admin/projects/${id}/published`, { method: 'PATCH' }),
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────
// Implemented in Module 2 — Dashboard Home
export const dashboardApi = {
  getStats: () => request('/api/admin/stats'),
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get:    () => request('/api/admin/settings'),
  update: (data) => request('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
}

export const publicationApi = {
  getAll: () => request('/api/admin/publication-jobs'),
  retry: (id) => request(`/api/admin/publication-jobs/${id}/retry`, { method: 'POST' }),
}
