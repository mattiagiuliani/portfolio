import { createServer } from 'node:net'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export async function freePort() {
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const port = probe.address().port
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()))
  return port
}

export function artifactDirectory(fallback) {
  return process.env.E2E_ARTIFACT_DIR
    ? pathToFileURL(path.resolve(process.env.E2E_ARTIFACT_DIR) + path.sep)
    : fallback
}
