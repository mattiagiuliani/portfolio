'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { mediaApi } from '../../services/adminApi'
import { createInlineImageMarkdown, findInlineMediaMarker, findInlineMediaMarkers, removeInlineMediaMarkers } from '../../lib/inlineMedia'

const formats = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
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

function explainUploadError(error) {
  if (error?.code === 'MEDIA_TOO_LARGE') return 'Image exceeds the upload size limit.'
  if (error?.code === 'MEDIA_TYPE') return 'Use a JPEG, PNG or WebP image with a matching filename.'
  if (error?.code === 'MEDIA_INVALID_IMAGE') return 'This image is corrupt or exceeds the supported dimensions.'
  if (error?.code === 'MEDIA_PROVIDER' || error?.code === 'MEDIA_PROVIDER_TIMEOUT') return 'Image storage could not confirm the upload. Retry in a moment.'
  if (error?.status === 401) return 'Your admin session expired. Sign in again before uploading.'
  if (error?.status === 429) return 'Too many uploads are active. Wait briefly, then retry.'
  return 'The upload could not reach the server. Check your connection and retry.'
}

function createMarker() {
  return `<!--portfolio-media-upload:${crypto.randomUUID()}-->`
}

export default function InlineMediaControl({ content, onContentChange, textareaRef, onPendingChange }) {
  const [operations, setOperations] = useState([])
  const [selectionError, setSelectionError] = useState('')
  const fileInputRef = useRef(null)
  const operationsRef = useRef([])
  const currentContent = useRef(content)
  const pickerOperation = useRef(null)
  const mounted = useRef(false)
  const pendingSelection = useRef(null)

  const unresolvedMarkers = findInlineMediaMarkers(content)
  const hasUnresolvedMarkers = unresolvedMarkers.length > 0

  const changeOperations = useCallback((update) => {
    const next = typeof update === 'function' ? update(operationsRef.current) : update
    operationsRef.current = next
    setOperations(next)
    onPendingChange(next.length > 0 || hasUnresolvedMarkers)
  }, [hasUnresolvedMarkers, onPendingChange])

  useEffect(() => {
    mounted.current = true
    onPendingChange(hasUnresolvedMarkers)
    return () => {
      mounted.current = false
      for (const operation of operationsRef.current) operation.controller?.abort()
      onPendingChange(false)
    }
  }, [hasUnresolvedMarkers, onPendingChange])

  useLayoutEffect(() => {
    currentContent.current = content
    operationsRef.current = operations
    if (pendingSelection.current && textareaRef.current && document.activeElement === textareaRef.current) {
      const { start, end } = pendingSelection.current
      textareaRef.current.setSelectionRange(start, end)
    }
    pendingSelection.current = null
    onPendingChange(operations.length > 0 || hasUnresolvedMarkers)
  }, [content, hasUnresolvedMarkers, onPendingChange, operations, textareaRef])

  useLayoutEffect(() => {
    const currentMarkers = findInlineMediaMarkers(content)
    const removed = operations.filter((operation) => !currentMarkers.some(({ marker }) => marker === operation.marker))
    if (removed.length) {
      for (const operation of removed) operation.controller?.abort()
      changeOperations((current) => current.filter((operation) => currentMarkers.some(({ marker }) => marker === operation.marker)))
    }
  }, [changeOperations, content, operations, textareaRef])

  const openPicker = () => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? content.length
    const end = textarea?.selectionEnd ?? start
    const marker = createMarker()
    const operation = { id: marker, marker, file: null, alt: '', status: 'selecting', error: '', controller: null }
    pickerOperation.current = marker
    setSelectionError('')
    changeOperations((current) => [...current, operation])
    onContentChange(`${content.slice(0, start)}${marker}${content.slice(end)}`)
    fileInputRef.current?.click()
  }

  const removeOperation = (id) => {
    const operation = operationsRef.current.find((item) => item.id === id)
    operation?.controller?.abort()
    if (operation) {
      onContentChange((current) => {
        const occurrence = findInlineMediaMarker(current, operation.marker)
        return occurrence ? current.slice(0, occurrence.start) + current.slice(occurrence.end) : current
      })
    }
    changeOperations((current) => current.filter((item) => item.id !== id))
    if (pickerOperation.current === id) pickerOperation.current = null
  }

  const selectFile = (event) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    const id = pickerOperation.current
    pickerOperation.current = null
    if (!id) return
    if (!file) {
      removeOperation(id)
      return
    }
    const error = validateFile(file)
    if (error) {
      removeOperation(id)
      setSelectionError(error)
      return
    }
    changeOperations((current) => current.map((operation) => operation.id === id
      ? { ...operation, file, status: 'ready', error: '' }
      : operation))
  }

  const updateOperation = (id, values) => {
    changeOperations((current) => current.map((operation) => operation.id === id ? { ...operation, ...values } : operation))
  }

  const upload = async (id) => {
    const operation = operationsRef.current.find((item) => item.id === id)
    if (!operation?.file || operation.status === 'uploading') return
    const controller = new AbortController()
    updateOperation(id, { status: 'uploading', error: '', controller })
    try {
      const result = await mediaApi.upload(operation.file, { signal: controller.signal })
      const currentOperation = operationsRef.current.find((item) => item.id === id)
      const occurrence = currentOperation ? findInlineMediaMarker(currentContent.current, currentOperation.marker) : null
      if (!mounted.current || !currentOperation || !occurrence) return
      const markdown = createInlineImageMarkdown(currentOperation.alt, result.data.id)
      const textarea = textareaRef.current
      if (textarea && document.activeElement === textarea) {
        const mapSelection = (value) => value <= occurrence.start
          ? value
          : value >= occurrence.end
            ? value + markdown.length - (occurrence.end - occurrence.start)
            : occurrence.start + markdown.length
        pendingSelection.current = {
          start: mapSelection(textarea.selectionStart),
          end: mapSelection(textarea.selectionEnd),
        }
      }
      onContentChange((current) => {
        const currentOccurrence = findInlineMediaMarker(current, currentOperation.marker)
        return currentOccurrence
          ? current.slice(0, currentOccurrence.start) + markdown + current.slice(currentOccurrence.end)
          : current
      })
      changeOperations((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      if (!mounted.current || error?.name === 'AbortError' || !operationsRef.current.some((item) => item.id === id)) return
      updateOperation(id, { status: 'failed', error: explainUploadError(error), controller: null })
    }
  }

  const removeOrphanMarkers = () => {
    onContentChange(removeInlineMediaMarkers)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openPicker}
          className="min-h-10 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-muted hover:text-white"
        >
          Insert image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={selectFile}
          onCancel={() => {
            if (pickerOperation.current) removeOperation(pickerOperation.current)
            pickerOperation.current = null
          }}
          aria-label="Inline image file"
          className="sr-only"
          tabIndex={-1}
        />
        <span className="text-xs text-subtle">JPEG, PNG or WebP</span>
      </div>

      {selectionError && <p role="alert" className="text-xs text-red-300">{selectionError}</p>}

      {unresolvedMarkers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-red-300" role="alert">
          <span>Unresolved inline image insertion. Remove the marker before saving.</span>
          <button type="button" onClick={removeOrphanMarkers} className="underline underline-offset-2">Remove unresolved markers</button>
        </div>
      )}

      {operations.map((operation) => (
        <div key={operation.id} className="flex flex-col gap-2 rounded-md border border-white/8 bg-bg/40 p-3">
          {operation.status === 'selecting' ? (
            <p role="status" className="text-xs text-muted">Choose an image, or cancel to remove its insertion point.</p>
          ) : (
            <>
              <p className="truncate text-xs text-muted" title={operation.file.name}>{operation.file.name}</p>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Inline image alt text
                <input
                  type="text"
                  maxLength={300}
                  value={operation.alt}
                  onChange={(event) => updateOperation(operation.id, { alt: event.target.value })}
                  className="min-h-10 rounded-md border border-white/8 bg-bg px-3 py-2 text-sm text-white focus:border-primary/50 focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => upload(operation.id)}
                  disabled={operation.status === 'uploading'}
                  className="min-h-10 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-45"
                >
                  {operation.status === 'uploading' ? 'Uploading…' : operation.status === 'failed' ? 'Retry upload' : 'Upload inline image'}
                </button>
                <button
                  type="button"
                  onClick={() => removeOperation(operation.id)}
                  className="min-h-10 rounded-md border border-white/10 px-3 py-2 text-xs text-muted"
                >
                  Cancel image
                </button>
              </div>
              {operation.status === 'uploading' && <p role="status" className="text-xs text-muted">Uploading image…</p>}
              {operation.status === 'failed' && <p role="alert" className="text-xs text-red-300">{operation.error}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  )
}