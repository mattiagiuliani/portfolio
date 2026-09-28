import sharp from 'sharp'
import { MediaError } from './errors.js'

const formats = {
  jpeg: { mime: 'image/jpeg', extension: /\.(jpg|jpeg)$/i },
  png: { mime: 'image/png', extension: /\.png$/i },
  webp: { mime: 'image/webp', extension: /\.webp$/i },
}

function sniff(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
}

// libvips may decode APNG as a still PNG: reject animation chunks explicitly.
function animatedPng(buffer) {
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'acTL') return true
    offset += length + 12
  }
  return false
}

function animatedWebp(buffer) {
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4)
    const length = buffer.readUInt32LE(offset + 4)
    if (type === 'ANIM' || type === 'ANMF') return true
    offset += 8 + length + (length % 2)
  }
  return false
}

export async function normalizeImage({ buffer, filename, mimeType }, maxBytes) {
  const format = sniff(buffer)
  const policy = formats[format]
  if (!policy || policy.mime !== mimeType || !policy.extension.test(filename)) throw new MediaError('MEDIA_TYPE')
  try {
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: 32000000 })
    const metadata = await image.metadata()
    if (metadata.format !== format || metadata.pages > 1 || metadata.width > 8192 || metadata.height > 8192
      || metadata.width * metadata.height > 32000000 || (format === 'png' && animatedPng(buffer))
      || (format === 'webp' && animatedWebp(buffer))) {
      throw new Error('Image policy')
    }
    // No keepMetadata/withMetadata: sharp strips EXIF, XMP and other input metadata.
    const { data, info } = await image.rotate().toFormat(format).timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true })
    if (data.length > maxBytes) throw new MediaError('MEDIA_TOO_LARGE')
    return { buffer: data, width: info.width, height: info.height, format, bytes: data.length }
  } catch (error) {
    if (error instanceof MediaError) throw error
    throw new MediaError('MEDIA_INVALID_IMAGE')
  }
}
