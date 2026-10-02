import { createServer } from 'node:http'
import { createConnection } from 'node:net'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHomeFixtures } from './home-fixtures.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const frontend = path.join(root, 'frontend', 'portfolio')
const host = process.env.HOME_E2E_HOST || '127.0.0.1'
const port = Number(process.env.HOME_E2E_PORT || 4179)
const runId = process.env.HOME_E2E_RUN_ID
const identity = randomUUID()
const { marker, respond, settings, projects } = createHomeFixtures(identity)
const buildDir = `.next-home-e2e-${port}-${runId}`
const fixtureUrlPath = `/${identity}`
const fixtureHits = new Set()
const fixture = createServer((request, response) => {
  const result = respond(request.url)
  fixtureHits.add(new URL(request.url, 'http://fixture').pathname)
  response.writeHead(result.status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(result.body))
})
let next
let build
let cleanupPromise
let stopping
let exitCode = 0

function rememberOutput(child) {
  let output = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (data) => {
      const text = data.toString()
      output = `${output}${text}`.slice(-16_000)
      ;(stream === child.stdout ? process.stdout : process.stderr).write(data)
    })
  }
  return () => output
}

function startProcess(args, env) {
  const child = spawn(process.execPath, args, {
    cwd: frontend,
    env,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = rememberOutput(child)
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })))
  return { child, exited, output }
}

function waitForChild(child, exited, timeoutMs, label, output) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms.\n${output()}`)), timeoutMs)
    exited.then(({ code, signal }) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`${label} exited with ${code ?? signal}.\n${output()}`))
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(new Error(`${label} could not start: ${error.message}`))
    })
  })
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    await new Promise((resolve) => killer.once('close', resolve))
    return
  }
  try { process.kill(-child.pid, 'SIGTERM') } catch { return }
  const stopped = await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(() => resolve(false), 4_000)),
  ])
  if (stopped === false) {
    try { process.kill(-child.pid, 'SIGKILL') } catch { /* process group already exited */ }
  }
}

function portIsOccupied(targetHost, targetPort) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: targetHost, port: targetPort })
    socket.setTimeout(500)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => { socket.destroy(); resolve(true) })
  })
}

async function waitForReadiness(baseUrl, child, exited, output) {
  const deadline = Date.now() + 60_000
  const expectedProject = projects[0].title
  while (Date.now() < deadline) {
    const ended = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(null), 0))])
    if (ended) throw new Error(`Next exited during startup (${ended.code ?? ended.signal}).\n${output()}`)
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) })
      const html = await response.text()
      if (response.status === 200 && html.includes(marker) && html.includes(settings.name) && html.includes(expectedProject)) {
        for (const route of ['/api/settings', '/api/projects', '/api/posts']) {
          if (!fixtureHits.has(`${fixtureUrlPath}${route}`)) {
            throw new Error(`Next readiness response had fixture identity but fixture route ${route} was not requested.`)
          }
        }
        return
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (error.message.includes('Next readiness response')) throw error
      if (Date.now() + 250 >= deadline) throw new Error(`Home server did not become ready: ${error.message}.\n${output()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Home server readiness timed out after 60000ms.\n${output()}`)
}

async function cleanup() {
  if (cleanupPromise) return cleanupPromise
  cleanupPromise = (async () => {
    await stopProcess(build?.child)
    await stopProcess(next?.child)
    if (fixture.listening) await new Promise((resolve) => fixture.close(resolve))
    await rm(path.join(frontend, buildDir), { recursive: true, force: true })
  })()
  return cleanupPromise
}

async function shutdown(code) {
  exitCode = code
  stopping?.()
  await cleanup()
}

async function main() {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`HOME_E2E_PORT must be an integer from 1024 to 65535; received ${process.env.HOME_E2E_PORT}`)
  }
  if (!/^[\da-f-]{36}$/i.test(runId || '')) throw new Error('Home E2E run identity is missing or invalid.')
  if (await portIsOccupied(host, port)) {
    throw new Error(`Home E2E port ${host}:${port} is already occupied. The harness will not reuse or stop that process. Stop it yourself or set HOME_E2E_PORT to another unused port.`)
  }

  fixture.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    fixture.once('listening', resolve)
    fixture.once('error', reject)
  })
  const apiUrl = `http://127.0.0.1:${fixture.address().port}${fixtureUrlPath}`
  const env = {
    ...process.env,
    NEXT_BUILD_DIR: buildDir,
    NEXT_PUBLIC_API_URL: apiUrl,
    PORTFOLIO_API_URL: apiUrl,
    SITE_URL: 'https://home-e2e.invalid',
    VERCEL_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
  }

  await rm(path.join(frontend, buildDir), { recursive: true, force: true })
  build = startProcess([path.join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', '--webpack'], env)
  await waitForChild(build.child, build.exited, 240_000, 'Home production build', build.output)

  next = startProcess([path.join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', host, '-p', String(port)], env)
  const baseUrl = `http://${host}:${port}/`
  await waitForReadiness(baseUrl, next.child, next.exited, next.output)
  console.log(`HOME_E2E_READY ${baseUrl} fixture=${identity} build=${buildDir}`)

  await new Promise((resolve, reject) => {
    stopping = resolve
    next.exited.then(({ code, signal }) => {
      if (stopping) reject(new Error(`Owned Next server exited unexpectedly (${code ?? signal}).\n${next.output()}`))
    })
  })
}

process.once('SIGINT', () => { void shutdown(130) })
process.once('SIGTERM', () => { void shutdown(143) })

try {
  await main()
} catch (error) {
  console.error(error.stack || error)
  exitCode = 1
} finally {
  await cleanup()
  process.exitCode = exitCode
}