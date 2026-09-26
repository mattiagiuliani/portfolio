// Public browser API URL. Server-rendered public pages use publicApi.server.js.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

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
