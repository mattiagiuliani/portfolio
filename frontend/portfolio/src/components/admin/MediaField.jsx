'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { mediaApi } from '../../services/adminApi'
import Field from './AdminField'

const formats = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const uploadErrors = {
  MEDIA_MULTIPART: 'Choose one image file and try again.',
  MEDIA_TOO_LARGE: 'Image exceeds the upload size limit.',
  MEDIA_TYPE: 'Use a JPEG, PNG or WebP image with a matching filename.',
  MEDIA_INVALID_IMAGE: 'This image is corrupt, animated or exceeds the supported dimensions.',
  MEDIA_UPLOAD_TIMEOUT: 'The upload timed out. Check your connection and retry.',
  MEDIA_PROVIDER: 'Image storage could not confirm the upload. Retry in a moment.',
  MEDIA_PROVIDER_TIMEOUT: 'Image storage timed out. Retry in a moment.',
  MEDIA_DATABASE: 'Image registration could not be completed. Retry in a moment.',
  MEDIA_CONFIG: 'Image uploads are temporarily unavailable.',
}

function explainUploadError(error) {
  if (uploadErrors[error?.code]) return uploadErrors[error.code]
  if (error?.status === 401) return 'Your admin session expired. Sign in again before uploading.'
  if (error?.status === 403) return 'Upload was not authorized. Refresh the page and try again.'
  if (error?.status === 429) return 'Too many uploads are active. Wait briefly, then retry.'
  if (error?.status === 503) return 'Image uploads are temporarily unavailable.'
  return 'The upload could not reach the server. Check your connection and retry.'
}

function validateFile(file) {
  const extension = `.${file.name.split('.').pop().toLowerCase()}`
  if (['.heic', '.heif'].includes(extension) || ['image/heic', 'image/heif'].includes(file.type.toLowerCase())) {
    return 'HEIC/HEIF is not supported yet. Choose a JPEG, PNG or WebP image.'
  }
  if (!formats[extension] || file.type.toLowerCase() !== formats[extension]) {
    return 'Choose a JPEG, PNG or WebP image with a matching filename and file type.'
  }
  return ''
}

export default function MediaField({
  label,
  mediaId,
  mediaPreview,
  legacyUrl,
  alt,
  defaultAlt = '',
  onMediaChange,
  onLegacyUrlChange,
  onAltChange,
  onPendingChange,
}) {
  const [file, setFile] = useState(null)
  const [localPreview, setLocalPreview] = useState('')
  const [uploadedPreview, setUploadedPreview] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)
  const [uploadsInFlight, setUploadsInFlight] = useState(0)
  const statusId = useId()
  const selection = useRef(0)
  const previewUrl = useRef('')
  const activeUpload = useRef(null)
  const activeUploads = useRef(new Set())
  const mounted = useRef(false)
  const lastUploadedId = useRef(null)

  const releasePreview = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = ''
    setLocalPreview('')
  }

  useEffect(() => {
    const selectionVersion = selection
    const requests = activeUploads.current
    mounted.current = true
    return () => {
      mounted.current = false
      selectionVersion.current++
      for (const controller of requests) controller.abort()
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    }
  }, [])

  const cancelSelection = () => {
    selection.current++
    for (const controller of activeUploads.current) controller.abort()
    activeUpload.current = null
    releasePreview()
    setFile(null)
    setUploadedPreview(null)
    setError('')
    onPendingChange(false)
    setStatus(mediaId && mediaId === lastUploadedId.current ? 'uploaded' : 'idle')
  }

  const selectFile = (event) => {
    const input = event.currentTarget
    const selected = input.files?.[0]
    input.value = ''
    if (!selected) return

    const validationError = validateFile(selected)
    if (validationError) {
      cancelSelection()
      setError(validationError)
      return
    }

    selection.current++
    activeUpload.current = null
    releasePreview()
    setFile(selected)
    setUploadedPreview(null)
    const nextPreview = URL.createObjectURL(selected)
    previewUrl.current = nextPreview
    setLocalPreview(nextPreview)
    setError('')
    setStatus('selected')
    onPendingChange(true)
  }

  const upload = async () => {
    if (!file || activeUploads.current.size) return
    const requestSelection = selection.current
    const controller = new AbortController()
    activeUpload.current = controller
    activeUploads.current.add(controller)
    setUploadsInFlight((count) => count + 1)
    setStatus('uploading')
    setError('')
    try {
      const result = await mediaApi.upload(file, { signal: controller.signal })
      if (requestSelection !== selection.current) return
      const asset = result.data
      const presentation = { url: asset.url, width: asset.width, height: asset.height, format: asset.format }
      lastUploadedId.current = asset.id
      setUploadedPreview(presentation)
      setStatus('uploaded')
      onMediaChange(asset.id, presentation)
      onPendingChange(false)
    } catch (uploadError) {
      if (requestSelection !== selection.current || uploadError?.name === 'AbortError') return
      setStatus('failed')
      setError(explainUploadError(uploadError))
    } finally {
      activeUploads.current.delete(controller)
      if (activeUpload.current === controller) activeUpload.current = null
      if (mounted.current) setUploadsInFlight((count) => Math.max(0, count - 1))
    }
  }

  const selectedPreview = status === 'uploaded' ? uploadedPreview?.url ?? mediaPreview?.url : localPreview
  const currentPreview = mediaId && mediaPreview?.url ? mediaPreview.url : legacyUrl
  const imageSrc = file ? selectedPreview : currentPreview
  const displayedAlt = alt ?? (mediaId ? defaultAlt : '')
  const currentDescription = mediaId
    ? mediaPreview?.url ? 'Current managed image. The legacy URL remains as fallback.' : 'Managed image preview unavailable; the legacy fallback is shown when available.'
    : legacyUrl ? 'Current legacy image. Uploading a managed image will leave this fallback stored.' : 'No current image.'

  useEffect(() => setPreviewFailed(false), [imageSrc])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label={`${label} file`} hint="JPEG, PNG or WebP. The image is uploaded only when you choose Upload image.">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={selectFile}
          aria-describedby={statusId}
          className="min-h-11 w-full min-w-0 text-sm text-muted file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-primary/15 file:px-3 file:font-semibold file:text-primary"
        />
      </Field>

      <p className="text-xs text-muted break-words [overflow-wrap:anywhere]" title={file?.name}>
        {file ? `Selected file: ${file.name}` : currentDescription}
      </p>

      {imageSrc && !previewFailed && (
        <img
          src={imageSrc}
          alt={displayedAlt}
          onError={() => setPreviewFailed(true)}
          className="max-h-56 w-full aspect-video object-contain rounded-md border border-white/8 bg-bg"
        />
      )}
      {imageSrc && previewFailed && (
        <p className="text-xs text-amber-300" role="status">Image preview could not be loaded.</p>
      )}

      <Field label={`${label} alt text`} hint="Leave blank for a decorative image.">
        <input
          type="text"
          maxLength={300}
          value={displayedAlt}
          onChange={(event) => onAltChange(event.target.value)}
          className="w-full min-w-0 rounded-lg border border-white/8 bg-bg px-3 py-2 text-sm text-white focus:border-primary/50 focus:outline-none"
        />
      </Field>

      <Field label={`${label} legacy fallback URL`} hint="Kept unchanged unless you edit it; removing managed media restores this value.">
        <input
          type="text"
          value={legacyUrl}
          onChange={(event) => onLegacyUrlChange(event.target.value)}
          className="w-full min-w-0 rounded-lg border border-white/8 bg-bg px-3 py-2 text-sm text-white focus:border-primary/50 focus:outline-none"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={upload}
          disabled={!file || uploadsInFlight > 0 || status === 'uploaded'}
          className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {status === 'uploading' ? 'Uploading…' : uploadsInFlight > 0 ? 'Waiting for previous upload…' : status === 'failed' ? 'Retry upload' : status === 'uploaded' ? 'Uploaded' : 'Upload image'}
        </button>
        {file && status !== 'uploaded' && (
          <button type="button" onClick={cancelSelection} disabled={status === 'uploading'} className="min-h-11 rounded-md border border-white/10 px-4 py-2 text-sm text-muted disabled:opacity-45">
            Cancel selection
          </button>
        )}
        {mediaId && (
          <button type="button" onClick={() => { cancelSelection(); lastUploadedId.current = null; setStatus('idle'); onMediaChange(null, null) }} className="min-h-11 rounded-md border border-white/10 px-4 py-2 text-sm text-muted">
            Remove managed image
          </button>
        )}
      </div>

      <p id={statusId} role="status" aria-live="polite" className="break-words text-xs text-muted [overflow-wrap:anywhere]">
        {status === 'selected' && uploadsInFlight === 0 && 'Selected locally. Not uploaded yet.'}
        {status === 'selected' && uploadsInFlight > 0 && 'A previous upload is finishing; its result will not be attached.'}
        {status === 'uploading' && 'Uploading image…'}
        {status === 'uploaded' && 'Uploaded as a media asset. Save this content to attach it.'}
        {status === 'failed' && 'Upload failed. Your selected file is ready to retry.'}
        {status === 'idle' && (mediaId ? 'Current managed image is saved with this content.' : '')}
      </p>
      {error && <p role="alert" className="break-words text-sm text-red-300 [overflow-wrap:anywhere]">{error}</p>}
    </div>
  )
}