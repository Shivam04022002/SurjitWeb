// Small pure helpers for the Advertisement page: what the form sends, what it
// refuses before sending, and what an advertisement needs before it can go
// live. The server validates all of this again — these only spare the admin a
// round trip and a confusing error.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
export const MAX_BUTTON_TEXT = 40
export const MAX_NAME = 150

// The same rule the server applies: a page on this site, or a full http(s)
// address. Anything else (javascript:, data:, mailto:, //host) is refused.
export const isSafeApplyUrl = (value) => {
  const url = String(value || '').trim()
  if (!url) return false
  if (url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export const imageFileError = (file) => {
  if (!file) return ''
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'The image must be PNG, JPG/JPEG or WebP'
  if (file.size > MAX_IMAGE_BYTES) return 'The image must be 5 MB or smaller'
  return ''
}

// Field errors, keyed by field name. `requireImage` is used for Publish: an
// advertisement with no artwork has nothing to show.
export const validateAdvertisement = (form, { requireImage = false, hasExistingImage = false } = {}) => {
  const errors = {}

  const name = String(form.name || '').trim()
  if (!name) errors.name = 'Name is required'
  else if (name.length > MAX_NAME) errors.name = `Name must not exceed ${MAX_NAME} characters`

  if (!isSafeApplyUrl(form.applyUrl)) {
    errors.applyUrl = 'Enter a page on this site (/loan-application) or a full https:// address'
  }

  const buttonText = String(form.applyButtonText || '').trim()
  if (buttonText.length > MAX_BUTTON_TEXT) {
    errors.applyButtonText = `Button text must not exceed ${MAX_BUTTON_TEXT} characters`
  }

  const fileError = imageFileError(form.imageFile)
  if (fileError) errors.imageFile = fileError
  else if (requireImage && !form.imageFile && !hasExistingImage) {
    errors.imageFile = 'An image is needed before this advertisement can be published'
  }

  return errors
}

// What goes on the wire. Multipart when a file was picked (the file field is
// `image`, which is what the server's upload middleware reads); plain JSON
// otherwise. imageUrl and the storage key are never sent — the server owns
// them.
export const buildAdvertisementPayload = (form) => {
  const name = String(form.name || '').trim()
  const applyUrl = String(form.applyUrl || '').trim()
  const applyButtonText = String(form.applyButtonText || '').trim() || 'Apply'

  if (!form.imageFile) return { name, applyUrl, applyButtonText }

  const fd = new FormData()
  fd.append('name', name)
  fd.append('applyUrl', applyUrl)
  fd.append('applyButtonText', applyButtonText)
  fd.append('image', form.imageFile)
  return fd
}

// The shared api client sends application/json by default, and axios takes
// that header literally: handed a FormData with a JSON content type it
// serialises the form to JSON, and a File becomes an empty object — the bytes
// never leave the browser and the save still succeeds. So a multipart payload
// says so explicitly, exactly as every other upload in this CMS does. Axios
// replaces this value with the real boundary before sending.
export const requestConfig = (payload) => (
    typeof FormData !== 'undefined' && payload instanceof FormData
        ? { headers: { 'Content-Type': 'multipart/form-data' } }
        : undefined
)

export const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!n || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

// The message an admin sees when a request fails. Server messages are shown
// as they are; anything else falls back to something readable, and a raw
// error is never surfaced.
export const advertisementError = (err, fallback) => {
  const status = err?.response?.status
  const serverMessage = err?.response?.data?.message
  const fieldMessage = err?.response?.data?.errors?.[0]?.message

  if (status === 401) return 'Your session has expired. Sign in again to continue.'
  if (status === 403) return 'Your role does not allow this action.'
  if (status === 404) return 'That advertisement no longer exists. The list has been refreshed.'
  if (status === 409) return serverMessage || 'Another advertisement was published just now. Try again.'
  if (status === 400) return fieldMessage || serverMessage || fallback
  if (status >= 500) return 'The server could not complete that. Try again in a moment.'
  if (!err?.response) return 'No response from the server. Check your connection and try again.'
  return serverMessage || fallback
}
