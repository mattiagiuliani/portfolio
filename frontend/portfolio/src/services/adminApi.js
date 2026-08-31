const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Core fetch wrapper for all admin API calls.
 * - Sends HTTP-only cookie automatically via credentials: 'include'
 * - Throws the parsed JSON body on non-2xx responses for unified error handling
 */
async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // required to send/receive the HTTP-only JWT cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const json = await res.json()
  if (!res.ok) throw json
  return json
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:  (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getMe:  () => request('/api/auth/me'),
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
