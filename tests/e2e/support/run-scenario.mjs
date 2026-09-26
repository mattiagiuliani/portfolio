import { spawn } from 'node:child_process'
import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))

// Every child owns its API, Next process and temporary Mongo. No existing server
// is reused. On timeout, terminate only this scenario's process tree.
export async function runScenario(name, testInfo, extraEnv = {}) {
  const entry = fileURLToPath(new URL(`../scenarios/${name}.mjs`, import.meta.url))
  const assets = testInfo.outputPath('assets')
  const child = spawn(process.execPath, [entry], {
    cwd: root, windowsHide: true, detached: process.platform !== 'win32',
    env: { ...process.env, ...extraEnv, E2E_ARTIFACT_DIR: assets, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let log = ''
  child.stdout.on('data', (data) => { log += data })
  child.stderr.on('data', (data) => { log += data })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* child already exited */ }
    }
  }, 270_000)
  let code
  try {
    code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
  } finally {
    clearTimeout(timer)
    await mkdir(testInfo.outputDir, { recursive: true })
    const logPath = testInfo.outputPath('scenario.log')
    await writeFile(logPath, log)
    await testInfo.attach('scenario log', { path: logPath, contentType: 'text/plain' })
    for (const file of await readdir(assets).catch(() => [])) {
      if (/\.(png|json|zip)$/.test(file)) await testInfo.attach(file, { path: path.join(assets, file) })
    }
  }
  if (code !== 0 || timedOut) throw new Error(`${name}: ${timedOut ? 'scenario timed out' : `exit ${code}`}\n${log.slice(-8000)}`)
}
