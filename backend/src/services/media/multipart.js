import busboy from 'busboy'
import { MediaError } from './errors.js'

export function readImagePart(req, maxBytes, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let parser
    try {
      if (!/^multipart\/form-data(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error()
      parser = busboy({ headers: req.headers, limits: {
        fileSize: maxBytes + 1, files: 1, fields: 0, parts: 2, headerPairs: 32,
      } })
    } catch {
      req.mediaBodyRejected = true
      req.pause()
      return reject(new MediaError('MEDIA_MULTIPART'))
    }
    let settled = false
    let total = 0
    let file
    const chunks = []
    const timer = setTimeout(() => finish(new MediaError('MEDIA_UPLOAD_TIMEOUT')), timeoutMs)
    const onAborted = () => finish(new MediaError('MEDIA_MULTIPART'))
    const onData = (chunk) => {
      total += chunk.length
      // Also bound multipart headers, fields, preamble and epilogue, including chunked bodies.
      if (total > maxBytes + 65536) finish(new MediaError('MEDIA_TOO_LARGE'))
    }
    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      req.off('data', onData)
      req.off('aborted', onAborted)
      req.off('error', onAborted)
      req.unpipe(parser)
      if (error) {
        chunks.length = 0
        // Do not destroy busboy synchronously from within one of its callbacks.
        queueMicrotask(() => parser.destroy())
        req.mediaBodyRejected = true
        req.pause()
        reject(error)
      } else {
        resolve({ ...file, buffer: Buffer.concat(chunks) })
      }
    }
    parser.on('file', (name, stream, info) => {
      stream.on('error', onAborted)
      if (name !== 'file' || !info.filename || file) {
        stream.resume()
        finish(new MediaError('MEDIA_MULTIPART'))
        return
      }
      file = info
      let size = 0
      stream.on('data', (chunk) => {
        size += chunk.length
        if (size > maxBytes) finish(new MediaError('MEDIA_TOO_LARGE'))
        else if (!settled) chunks.push(chunk)
      })
      stream.on('limit', () => finish(new MediaError('MEDIA_TOO_LARGE')))
    })
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit', 'field']) {
      parser.on(event, () => finish(new MediaError('MEDIA_MULTIPART')))
    }
    parser.on('error', onAborted)
    parser.on('close', () => finish(file && chunks.length ? null : new MediaError('MEDIA_MULTIPART')))
    req.on('data', onData)
    req.on('aborted', onAborted)
    req.on('error', onAborted)
    req.pipe(parser)
  })
}
