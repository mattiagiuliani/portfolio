import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const runId = process.env.HOME_E2E_RUN_ID
export default async function homeTeardown() {
  if (/^[\da-f-]{36}$/i.test(runId || '')) {
    const port = Number(process.env.HOME_E2E_PORT || 4179)
    if (Number.isInteger(port) && port >= 1024 && port <= 65535) {
      await rm(path.join(root, 'frontend', 'portfolio', `.next-home-e2e-${port}-${runId}`), { recursive: true, force: true })
    }
  }
}