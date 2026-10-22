// Private files (loan documents, job applicants' CVs) in the CMS. The server
// streams each file only to staff allowed to see it; the browser holds it in
// memory and never learns where it is stored.

// The statuses the server reports for a stored file.
export const FILE_STATUS = {
  available: { label: 'Received', color: 'success', openable: true },
  recorded: { label: 'Received', color: 'success', openable: true },
  missing: { label: 'File missing from storage', color: 'error', openable: false },
  unrecognised: { label: 'Not in CMS document storage', color: 'error', openable: false },
  unchecked: { label: 'Could not be verified', color: 'warning', openable: true },
  not_provided: { label: 'Not attached', color: 'default', openable: false }
}

export const fileStatus = (status) => FILE_STATUS[status] || { label: status || 'Unknown', color: 'default', openable: false }

// File types a browser shows safely in a new tab; everything else downloads.
const INLINE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const opensInline = (blobType) => INLINE_TYPES.has(String(blobType || '').split(';')[0].trim())

// What to tell the user when a file could not be fetched.
export const fileErrorMessage = (status, noun = 'document') => {
  if (status === 401) return 'Your session has expired. Sign in again to open this file.'
  if (status === 403) return `You do not have access to this ${noun}.`
  if (status === 404) return `That ${noun} is no longer available in storage.`
  return `The ${noun} could not be opened. Please try again.`
}

// Shows a file that has already been fetched: in a new tab when the browser
// can display it safely, otherwise as a download. Nothing is opened until the
// file is in hand, so a refused or failed request never leaves a blank tab.
// Returns 'opened' or 'downloaded' — a viewable file is downloaded instead
// when the browser blocks the new tab.
export const showFile = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  let result = 'downloaded'
  const tab = opensInline(blob.type) ? window.open(url, '_blank') : null
  if (tab) {
    tab.opener = null
    result = 'opened'
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'file'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
  return result
}
