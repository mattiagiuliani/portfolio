# Media uploads — Checkpoint 1

This checkpoint provides a backend upload primitive only. There is no media picker,
Post/Project association, replacement, deletion, migration or cleanup worker yet.

## Request and security boundary

`POST /api/admin/media`: the browser uses the existing **same-origin** Next rewrite
to Express, with its `admin_token` cookie and `credentials: 'include'`. No new Next
route handler is needed. Uploads do not acquire the login/logout Web Lock.

Express applies the existing `verifyToken`, `adminOnly` and `verifyOrigin` before
the media router. Media additionally requires an explicit Origin in
`FRONTEND_ORIGIN`; absent/`null` origins are rejected. Other admin routes retain
their existing origin behavior. No upload response sets or clears cookies.

Send exactly one multipart **file** field with a filename; no additional fields.
Do not manually set multipart Content-Type in a browser: FormData supplies its boundary.
The file must be a still JPEG (`.jpg`/`.jpeg`, `image/jpeg`), PNG (`.png`, `image/png`)
or WebP (`.webp`, `image/webp`). SVG, GIF, APNG/animated WebP, HEIC/HEIF, PDF, video,
HTML and arbitrary binary inputs are unsupported. Extension, MIME and signature
must agree, followed by actual decoding; none of these claims alone is trusted.

Successful response, **201**, `Cache-Control: no-store`:

```json
{"success":true,"data":{"id":"<Mongo ObjectId>","url":"https://<canonical-image-url>","width":1200,"height":800,"format":"jpeg","bytes":123456}}
```

No provider key, provider response, credentials, original filename or filesystem
path is returned. Auth failures retain existing response conventions. Media errors
use `{ "success": false, "code": "MEDIA_...", "message": "<safe explanation>" }`.

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid multipart, missing/multiple files or additional fields |
| 401 / 403 | Existing auth/authorization checks or missing/disallowed Origin |
| 408 | Multipart body did not complete within 30 seconds |
| 413 | File, normalized output or multipart envelope exceeds byte limit |
| 415 | Unsupported content or MIME/extension mismatch |
| 422 | Corrupt/animated image or excessive dimensions/pixels |
| 429 | Upload rate limit or another upload is active |
| 502 / 504 | Provider could not confirm upload / provider deadline expired |
| 503 | Storage configuration or Mongo registration unavailable |

## Limits and processing

Default input **and normalized output** limit: **3 MiB** (`MEDIA_MAX_BYTES=3145728`).
Configurable range: 1 KiB–8 MiB. The multipart envelope has a separate ceiling of
file limit + 64 KiB, counted from the stream even without Content-Length. Busboy
bounds fields/files/parts; no temporary filesystem upload is created.

The repository establishes a Next external rewrite but does **not** prove the
deployed Vercel → Render body limit. The 3 MiB default is conservative, not a claim
of verified production support. Validate a near-limit upload on staging before
raising it. A hosting proxy may reject a request before Express returns its envelope.

Sharp/libvips runs on the existing Node >=22 backend: strict decoder errors,
32,000,000 maximum pixels, 8192 maximum width/height, a 10-second processing deadline,
EXIF orientation applied, metadata stripped, re-encoded in the same accepted format.
Re-encoding is intentional; JPEG/WebP may lose some quality. No resizing, thumbnail
generation or expensive transformations beyond this normalization are performed.
One decode/upload is admitted per backend process; overlapping uploads get 429
instead of building an unbounded memory queue. These limits bound work, not a
guarantee of peak RSS on every hosting plan; profile representative large images
before increasing limits. Existing global request limiting remains unchanged.
Media also has an authenticated-admin quota of 10 attempts per 15 minutes, using
the existing express-rate-limit memory store. Both admission and quotas are per
process; horizontal scaling will require a shared limiter in a later checkpoint.

## Storage configuration

Set **only on Express/Render**, never `NEXT_PUBLIC_*`:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `MEDIA_NAMESPACE`, required, e.g. `portfolio/production` or `portfolio/staging`.
  Pattern: `portfolio/` followed by 1–48 lowercase alphanumeric/underscore/hyphen
  characters, starting with an alphanumeric character. Use separate namespaces
  (preferably separate cloud environments) between deployments.
- `MEDIA_MAX_BYTES`, optional, default 3145728.
- `MEDIA_PROVIDER_TIMEOUT_MS`, optional, default 15000, allowed 1000–60000.

Missing/invalid configuration disables media uploads with 503; it does not prevent
existing portfolio/admin APIs from starting. The server loads local configuration
in its existing way; the adapter reads it lazily when an upload is requested.

Cloudinary's adapter is the only code aware of its REST fields. It signs a fixed
image upload server-side with SHA-256, a generated `namespace/MongoObjectId` key and
`overwrite=false`; it never ingests browser-supplied remote URLs or provider options.
It uses native Node fetch/FormData and AbortSignal, refuses redirects, bounds the
response at 64 KiB, and checks owner key, resource type, canonical versioned HTTPS
URL, dimensions, bytes and format against the normalized image. No upload presets
or incoming transformations should alter the stored image; altered metadata is
rejected rather than silently trusted. No Cloudinary SDK dependency is needed.

## Registry and partial failure contract

`MediaAsset`: `_id`, immutable `provider`, immutable unique `key`, immutable
`createdBy` (Admin ObjectId), `state` (`pending`/`ready`/`failed`), canonical `url`,
`width`, `height`, `format` (`jpeg`/`png`/`webp`), `bytes`, optional safe `failureCode`
(`MEDIA_PROVIDER`/`MEDIA_PROVIDER_TIMEOUT`), `createdAt`, `updatedAt`.
URL and positive integer dimensions/bytes/format are required for ready records.

1. Validation fails: no registry record and no provider call.
2. Initial Mongo insert fails: no provider call, sanitized 503.
3. Insert succeeds: **pending** intent is durable before the external upload.
4. Provider rejects/times out/returns invalid metadata: mark **failed** if possible,
   otherwise leave pending. Return 502/504, never a ready asset. A failed record does
   **not** prove remote absence: the provider may have accepted an upload before the
   response was lost. Retain the key in either state for reconciliation.
5. Provider succeeds but final Mongo save fails: return 503, never ready metadata.
   The intent remains pending, or may already be ready if the DB acknowledgment was
   lost. Do not overwrite that ambiguous state or delete anything automatically.
6. Final Mongo acknowledgment succeeds: return 201 with the safe asset contract.
7. Process crash/client disconnect: a pending or ready registry record still owns
   the generated provider key. A client retry is a new upload, not idempotent;
   avoid automatic retries that could accumulate duplicate assets.

Provider operations run outside Mongo transactions. There is no automatic
reconciliation/retry/delete in this checkpoint. An operator can inspect pending/
failed records and look up their exact provider/key later; retain these records.
Content references and cleanup policy belong to future checkpoints, so successful
uploads currently remain unreferenced. No publication jobs are enqueued.

## Tests

```sh
cd backend
node --test test/media.test.js test/media-storage.test.js
```

The HTTP tests mount the real admin router, real JWT middleware and a disposable
local MongoDB, then inject a fake storage adapter. They inspect actual provider
arguments, normalized bytes and persisted registry state. Adapter tests inject
fetch to verify signed requests, response validation and abort behavior. No live
Cloudinary credentials, provider calls or quota are used. Binary fixtures are small
and generated in memory. As with existing backend integration tests,
mongodb-memory-server needs a local cached MongoDB binary (first setup may download
it); once cached the tests do not require internet access.
