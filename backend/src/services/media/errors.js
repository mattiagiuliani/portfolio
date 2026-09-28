const definitions = {
  MEDIA_CONFIG: [503, 'Media uploads are not configured.'],
  MEDIA_MULTIPART: [400, 'Send exactly one image in the file field, without other fields.'],
  MEDIA_TOO_LARGE: [413, 'Image exceeds the upload size limit.'],
  MEDIA_TYPE: [415, 'Use a JPEG, PNG or WebP image with matching filename and MIME type.'],
  MEDIA_INVALID_IMAGE: [422, 'Image is corrupt, animated or exceeds the image dimensions limit.'],
  MEDIA_UPLOAD_TIMEOUT: [408, 'Upload request timed out.'],
  MEDIA_PROVIDER: [502, 'Image storage could not confirm the upload.'],
  MEDIA_PROVIDER_TIMEOUT: [504, 'Image storage timed out.'],
  MEDIA_DATABASE: [503, 'Image registration could not be completed.'],
}

export class MediaError extends Error {
  constructor(code) {
    super(definitions[code][1])
    this.code = code
    this.status = definitions[code][0]
  }
}

export function sendMediaError(res, error) {
  const safe = error instanceof MediaError ? error : new MediaError('MEDIA_DATABASE')
  return res.status(safe.status).json({ success: false, code: safe.code, message: safe.message })
}
