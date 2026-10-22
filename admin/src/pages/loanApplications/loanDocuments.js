// Loan application documents in the CMS: how each status reads, and the
// rules for the deep link the notification email uses. Kept apart from the
// components so they can be tested without a browser.

// Statuses and file types are shared with the other private files (CVs).
import { FILE_STATUS, fileStatus, opensInline } from '../../utils/privateFiles.js'

export const DOCUMENT_STATUS = FILE_STATUS
export const documentStatus = fileStatus
export { opensInline }

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
