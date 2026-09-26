import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

const pathPattern = /^\/(?:blog(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)?$/

function secretsMatch(received, expected) {
  if (!received || !expected) return false
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer)
}

export async function POST(request) {
  if (!secretsMatch(request.headers.get('x-revalidation-secret'), process.env.REVALIDATION_SECRET)) {
    return NextResponse.json({ accepted: false, message: 'Unauthorized' }, { status: 401 })
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ accepted: false, message: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(payload?.paths) || payload.paths.length > 100) {
    return NextResponse.json({ accepted: false, message: 'Invalid public paths' }, { status: 400 })
  }
  const paths = [...new Set(payload.paths)]
  if (!paths.length || !paths.every((path) => typeof path === 'string' && pathPattern.test(path))) {
    return NextResponse.json({ accepted: false, message: 'Invalid public paths' }, { status: 400 })
  }

  for (const path of paths) {
    // Keep the last successful page available while fresh data regenerates.
    // The worker, not this acknowledgement, verifies publication completion.
    revalidateTag(`page:${path}`, 'max')
  }
  // Also refresh every cached page of the public listing used by sitemap.xml.
  if (paths.some((path) => path === '/blog' || path.startsWith('/blog/'))) revalidateTag('posts', 'max')

  return NextResponse.json({ accepted: true, paths })
}
