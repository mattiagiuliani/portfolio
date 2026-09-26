import { createHash } from 'node:crypto'

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

export function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

// Identical contract in backend and frontend; parity is enforced by a test.
export async function publicSnapshot(path, get) {
  let data
  if (path === '/') {
    const settings = await get('/api/settings')
    const projects = await get('/api/projects')
    const preview = await get('/api/posts?limit=3&sort=-publishedAt')
    data = { settings: settings.data, projects: projects.data, preview: preview.data }
  } else if (path === '/blog') {
    const listing = await get('/api/posts?page=1&limit=9')
    const featured = await get('/api/posts?featured=true&limit=1')
    data = { posts: listing.data, pagination: listing.pagination, featured: featured.data[0] ?? null }
  } else {
    const post = await get(`/api/posts/${encodeURIComponent(path.slice('/blog/'.length))}`)
    data = { post: post.data }
  }
  return { data, revision: fingerprint(data) }
}
