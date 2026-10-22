// Loan application documents in the CMS: how each status reads, and the
// rules for the deep link the notification email uses. Kept apart from the
// components so they can be tested without a browser.

// The statuses the server reports for each document slot.
export const DOCUMENT_STATUS = {
  available: { label: 'Received', color: 'success', openable: true },
  recorded: { label: 'Received', color: 'success', openable: true },
  missing: { label: 'File missing from storage', color: 'error', openable: false },
  unrecognised: { label: 'Not in CMS document storage', color: 'error', openable: false },
  unchecked: { label: 'Could not be verified', color: 'warning', openable: true },
  not_provided: { label: 'Not attached', color: 'default', openable: false }
}

export const documentStatus = (status) => DOCUMENT_STATUS[status] || { label: status || 'Unknown', color: 'default', openable: false }

// Documents that were actually uploaded (any status but not_provided).
export const attachedDocuments = (documents = []) => documents.filter((d) => d.status !== 'not_provided')

export const documentSummary = (documents = []) => {
  const attached = attachedDocuments(documents)
  if (!attached.length) return 'No documents were attached to this application.'
  const problems = attached.filter((d) => !documentStatus(d.status).openable).length
  return `${attached.length} document${attached.length === 1 ? '' : 's'} attached${problems ? `, ${problems} unavailable` : ''}`
}

// The application a deep link asks for (?application=<id>), or null. Only a
// 24-character database id is accepted.
export const applicationIdFromSearch = (search) => {
  const id = new URLSearchParams(search || '').get('application')
  return id && /^[a-f0-9]{24}$/i.test(id) ? id : null
}

// File types a browser shows safely in a new tab; everything else downloads.
const INLINE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const opensInline = (blobType) => INLINE_TYPES.has(String(blobType || '').split(';')[0].trim())
