// Base URL from env — falls back to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ─── Blog API ─────────────────────────────────────────────────────────────────

export const blogApi = {
  /**
   * Fetch a paginated, filtered list of published posts.
   * @param {Object} params - Query params: page, limit, category, tag, featured, search, sort
   * @returns {Promise<{ success: boolean, data: Post[], pagination: Pagination }>}
   */
  fetchPosts: async (params = {}) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') search.set(k, v)
    })
    const qs = search.toString()
    const res = await fetch(`${BASE_URL}/api/posts${qs ? `?${qs}` : ''}`)
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },

  /**
   * Fetch a single published post by its slug.
   * @param {string} slug
   * @returns {Promise<{ success: boolean, data: Post }>}
   */
  fetchPost: async (slug) => {
    const res = await fetch(`${BASE_URL}/api/posts/${encodeURIComponent(slug)}`)
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },

  /**
   * Create a new post.
   * @param {Object} data - Post fields
   */
  createPost: async (data) => {
    const res = await fetch(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },

  /**
   * Update an existing post by its MongoDB ObjectId.
   * @param {string} id - MongoDB ObjectId
   * @param {Object} data - Fields to update
   */
  updatePost: async (id, data) => {
    const res = await fetch(`${BASE_URL}/api/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },

  /**
   * Delete a post by its MongoDB ObjectId.
   * @param {string} id - MongoDB ObjectId
   */
  deletePost: async (id) => {
    const res = await fetch(`${BASE_URL}/api/posts/${id}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },
}

// ─── Contact API ──────────────────────────────────────────────────────────────

export const contactApi = {
  /**
   * Submit a contact form message.
   * @param {{ name: string, email: string, message: string }} data
   * @returns {Promise<{ success: boolean, message: string, id: string }>}
   * @throws parsed JSON error body on non-2xx responses
   */
  submit: async (data) => {
    const res = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json()

    if (!res.ok) throw json

    return json
  },
}

export const portfolioApi = {
  fetchProjects: async () => {
    const res = await fetch(`${BASE_URL}/api/projects`)
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },

  fetchSettings: async () => {
    const res = await fetch(`${BASE_URL}/api/settings`)
    const json = await res.json()
    if (!res.ok) throw json
    return json
  },
}
