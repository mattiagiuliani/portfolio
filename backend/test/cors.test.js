import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import express from 'express'
import cors from 'cors'
import { corsOptions } from '../src/config/cors.js'

const request = (app, options) => new Promise((resolve, reject) => {
  const server = app.listen(0, () => {
    const { port } = server.address()
    const req = http.request({ port, ...options }, (res) => {
      res.resume()
      res.on('end', () => {
        server.close()
        resolve(res)
      })
    })
    req.on('error', reject)
    req.end()
  })
})

test('CORS accepts PATCH preflight from an authorized origin', async () => {
  process.env.FRONTEND_ORIGIN = 'https://portfolio.example,https://preview.example'
  const app = express()
  app.use(cors(corsOptions))
  app.patch('/api/admin/projects/id/published', (_req, res) => res.sendStatus(204))

  const res = await request(app, {
    method: 'OPTIONS', path: '/api/admin/projects/id/published',
    headers: {
      Origin: 'https://portfolio.example',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  assert.equal(res.statusCode, 204)
  assert.equal(res.headers['access-control-allow-origin'], 'https://portfolio.example')
  assert.match(res.headers['access-control-allow-methods'], /PATCH/)
})

test('CORS rejects an unauthorized origin while serving authorized PATCH requests', async () => {
  process.env.FRONTEND_ORIGIN = 'https://portfolio.example'
  const app = express()
  app.use(cors(corsOptions))
  app.patch('/api/admin/projects/id/published', (_req, res) => res.sendStatus(204))

  const allowed = await request(app, {
    method: 'PATCH', path: '/api/admin/projects/id/published', headers: { Origin: 'https://portfolio.example' },
  })
  const denied = await request(app, {
    method: 'OPTIONS', path: '/api/admin/projects/id/published',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PATCH' },
  })

  assert.equal(allowed.headers['access-control-allow-origin'], 'https://portfolio.example')
  assert.equal(denied.headers['access-control-allow-origin'], undefined)
})
