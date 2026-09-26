import { getPublicSettings, getPublicProjects } from '../controllers/publicController.js'
import { getPosts, getPostBySlug } from '../controllers/postController.js'
import { publicSnapshot } from './publicSnapshot.js'

// Use the same public serializers as Express, without consuming HTTP rate limits.
async function readPublicJson(path) {
  const url = new URL(path, 'http://local')
  const req = { query: Object.fromEntries(url.searchParams), params: {} }
  let handler
  if (url.pathname === '/api/settings') handler = getPublicSettings
  else if (url.pathname === '/api/projects') handler = getPublicProjects
  else if (url.pathname === '/api/posts') handler = getPosts
  else {
    handler = getPostBySlug
    req.params.slug = decodeURIComponent(url.pathname.slice('/api/posts/'.length))
  }
  let status = 200
  let payload
  let failure
  await handler(req, {
    status(code) { status = code; return this },
    json(value) { payload = value },
  }, (error) => { failure = error })
  if (failure) throw failure
  if (status !== 200) throw Object.assign(new Error('Public content unavailable'), { status })
  // Match JSON serialization of dates/ObjectIds on the actual wire.
  return JSON.parse(JSON.stringify(payload))
}

export async function readPublicSnapshot(path) {
  try {
    const snapshot = await publicSnapshot(path, readPublicJson)
    return { status: 200, revision: snapshot.revision }
  } catch (error) {
    if (error.status === 404) return { status: 404, revision: null }
    throw error
  }
}
