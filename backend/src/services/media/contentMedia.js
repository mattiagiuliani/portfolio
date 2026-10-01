import MediaAsset from '../../models/MediaAsset.js'
import { parseInlineMarkdown, resolveInlineMarkdown, uniqueInlineMediaIds } from './inlineMarkdown.js'

const fields = {
  post: { reference: 'coverMedia', legacy: 'coverImage', alt: 'coverAlt' },
  project: { reference: 'imageMedia', legacy: 'image', alt: 'imageAlt' },
}
const validId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
const canonicalFields = 'state url width height format bytes'

export class MediaAssociationError extends Error {
  constructor(field, unavailable = false) {
    super(unavailable ? 'Media registry is temporarily unavailable.' : 'Use a ready media asset ID and valid image presentation data.')
    this.field = field
    this.status = unavailable ? 503 : 422
    this.code = unavailable ? 'MEDIA_ASSOCIATION_UNAVAILABLE' : 'MEDIA_ASSOCIATION_INVALID'
  }
}

export function readyPresentation(asset) {
  if (!asset || asset.state !== 'ready') return false
  try {
    const url = new URL(asset.url)
    return url.protocol === 'https:' && url.href === asset.url && !url.username && !url.password && !url.search && !url.hash
      && ['jpeg', 'png', 'webp'].includes(asset.format)
      && [asset.width, asset.height, asset.bytes].every((value) => Number.isSafeInteger(value) && value > 0)
      && asset.width <= 8192 && asset.height <= 8192 && asset.width * asset.height <= 32000000
  } catch { return false }
}

async function loadReadyAssetsByIds(ids, field) {
  if (!ids.length) return new Map()
  let assets
  try {
    assets = await MediaAsset.find({ _id: { $in: ids }, state: 'ready' }).select(canonicalFields).lean()
  } catch (error) {
    if (error.hasErrorLabel?.('TransientTransactionError')) throw error
    throw new MediaAssociationError(field, true)
  }
  return new Map(assets.filter(readyPresentation).map((asset) => [String(asset._id).toLowerCase(), asset]))
}

async function loadReadyAssets(records, reference) {
  const ids = [...new Set(records.map((record) => String(record[reference] ?? '')).filter(validId))]
  if (!ids.length) return new Map()

  let assets
  try {
    assets = await MediaAsset.find({ _id: { $in: ids }, state: 'ready' }).select(canonicalFields).lean()
  } catch {
    throw new MediaAssociationError(reference, true)
  }
  return new Map(assets.filter(readyPresentation).map((asset) => [String(asset._id), asset]))
}

// Called before content mutation, within its existing publication transaction.
// This registry is shared by the private admins; createdBy is provenance, not tenancy.
export async function validateContentMedia(input, kind) {
  const { reference, alt } = fields[kind]
  for (const key of Object.keys(input)) {
    if (key.startsWith(`${reference}.`) || key.startsWith(`${alt}.`)) throw new MediaAssociationError(reference)
  }
  if (Object.hasOwn(input, alt) && input[alt] !== null
    && (typeof input[alt] !== 'string' || input[alt].length > 300)) throw new MediaAssociationError(alt)
  if (kind === 'post' && Object.hasOwn(input, 'content')) {
    if (typeof input.content !== 'string') throw new MediaAssociationError('content')
    const parsed = parseInlineMarkdown(input.content)
    if (parsed.hasPendingMarker || parsed.references.some(({ id }) => !id)) throw new MediaAssociationError('content')
    const ids = uniqueInlineMediaIds(parsed)
    const assets = await loadReadyAssetsByIds(ids, 'content')
    if (ids.some((id) => !assets.has(id))) throw new MediaAssociationError('content')
  }
  if (!Object.hasOwn(input, reference) || input[reference] === null) return
  if (!validId(input[reference])) throw new MediaAssociationError(reference)
  let asset
  try {
    asset = await MediaAsset.findById(input[reference]).select(canonicalFields).lean()
  } catch (error) {
    // Preserve Mongo's existing transaction retry semantics for transient reads.
    if (error.hasErrorLabel?.('TransientTransactionError')) throw error
    throw new MediaAssociationError(reference, true)
  }
  if (!readyPresentation(asset)) throw new MediaAssociationError(reference)
}

// One bounded registry query per public list, no populated Mongo documents on the wire.
// Existing legacy-only records keep their exact public shape and require no registry read.
export async function serializeContentMedia(records, kind) {
  const { reference, legacy, alt } = fields[kind]
  const ready = await loadReadyAssets(records, reference)
  const parsedBodies = kind === 'post'
    ? records.map((record) => typeof record.content === 'string' ? parseInlineMarkdown(record.content) : null)
    : []
  const inlineIds = [...new Set(parsedBodies.flatMap((parsed) => parsed ? uniqueInlineMediaIds(parsed) : []))]
  const inlineReady = await loadReadyAssetsByIds(inlineIds, 'content')
  return records.map((record, index) => {
    const { [reference]: id, ...publicRecord } = record
    const asset = ready.get(String(id))
    if (asset) {
      const { url, width, height, format } = asset
      publicRecord[legacy] = url
      publicRecord[reference] = { url, width, height, format, alt: record[alt] ?? record.title ?? '' }
    }
    const parsedBody = parsedBodies[index]
    if (parsedBody) publicRecord.content = resolveInlineMarkdown(parsedBody, inlineReady)
    return publicRecord
  })
}

// Admin editors need an image URL to preview a saved ID, but never need registry internals.
export async function serializeAdminContentMedia(records, kind) {
  const { reference } = fields[kind]
  const ready = await loadReadyAssets(records, reference)
  return records.map((record) => {
    const asset = ready.get(String(record[reference]))
    if (!asset) return record
    const { url, width, height, format } = asset
    return { ...record, [`${reference}Preview`]: { url, width, height, format } }
  })
}
