// The rules behind the Email Delivery Log: how each delivery status reads,
// what each outcome code means, and which filters may be sent. The server
// decides everything that matters — including whether a row may be retried —
// and these functions only describe it.

// The statuses the server reports. `unconfirmed` is a failed record closed as
// SEND_UNCONFIRMED: the server lists it separately because it is not a refusal.
export const STATUS_META = {
  sent: {
    label: 'Accepted by Microsoft',
    color: 'success',
    description: 'Microsoft 365 accepted the email for delivery. That is not proof it reached each inbox.'
  },
  pending: {
    label: 'Pending',
    color: 'default',
    description: 'Queued and about to be sent.'
  },
  sending: {
    label: 'Sending',
    color: 'info',
    description: 'A send is in progress.'
  },
  retrying: {
    label: 'Retry scheduled',
    color: 'warning',
    description: 'A temporary Microsoft problem stopped the send. It will be tried again automatically.'
  },
  skipped: {
    label: 'Skipped',
    color: 'default',
    description: 'Not sent, by design — for example notifications were off or email was not set up. It will not be sent later.'
  },
  failed: {
    label: 'Failed',
    color: 'error',
    description: 'Microsoft refused the email, or every allowed attempt failed. It will not be retried.'
  },
  unconfirmed: {
    label: 'Delivery uncertain',
    color: 'error',
    description: 'The send did not complete, so Microsoft may or may not have accepted the email. It is never resent automatically, to avoid a duplicate — check with the recipients.'
  }
}

export const STATUS_ORDER = ['sent', 'pending', 'sending', 'retrying', 'skipped', 'failed', 'unconfirmed']

// Outcome codes the server records. An unknown code is shown as itself.
export const OUTCOME_LABELS = {
  SENT: 'Accepted by Microsoft for delivery',
  DISABLED: 'Loan application emails were turned off in Email Settings',
  NOT_CONFIGURED: 'The email provider was not set up in the API section',
  NO_RECIPIENTS: 'No notification recipient was saved in Email Settings',
  PRODUCT_NOT_SELECTED: 'Its product is not one of those selected in Product Notification Rules',
  APPLICATION_NOT_FOUND: 'The application no longer exists',
  SEND_UNCONFIRMED: 'The send did not complete — delivery is uncertain',
  THROTTLED: 'Microsoft asked the CMS to slow down',
  MICROSOFT_UNAVAILABLE: 'Microsoft was temporarily unavailable',
  NETWORK: 'Microsoft could not be reached',
  TIMEOUT: 'Microsoft did not answer the sign-in request in time',
  INVALID_CLIENT_SECRET: 'Microsoft rejected the client secret',
  CLIENT_SECRET_EXPIRED: 'The client secret has expired',
  APP_NOT_FOUND: 'The app registration was not found in the tenant',
  TENANT_NOT_FOUND: 'The tenant was not found',
  APP_DISABLED: 'The app registration is disabled',
  INVALID_CLIENT: 'Microsoft rejected the app credentials',
  AUTH_FAILED: 'Microsoft refused to sign the app in',
  ACCESS_DENIED: 'The app may not send as the sender mailbox',
  MAILBOX_NOT_FOUND: 'The sender mailbox was not found',
  REJECTED: 'Microsoft rejected the message',
  TOKEN_REJECTED: 'Microsoft rejected the access token',
  DELIVERY_FAILED: 'Microsoft could not send the message',
  UNEXPECTED: 'An unexpected server error'
}

export const statusMeta = (status) => STATUS_META[status] || { label: status || 'Unknown', color: 'default', description: '' }
export const outcomeLabel = (code) => (code ? OUTCOME_LABELS[code] || code : '')

const DAY = /^\d{4}-\d{2}-\d{2}$/

// The query for the current filters, or an error to show instead of asking.
// The server checks the same things; this only saves a refused request.
export const filtersToParams = ({ status = '', from = '', to = '', page = 0, pageSize = 20 }) => {
  if (status && !STATUS_META[status]) return { error: 'Choose a listed status.' }
  if (from && !DAY.test(from)) return { error: 'Enter the "from" date as a full date.' }
  if (to && !DAY.test(to)) return { error: 'Enter the "to" date as a full date.' }
  if (from && to && to < from) return { error: 'The "to" date is before the "from" date.' }
  const params = { page: page + 1, limit: Math.min(Math.max(pageSize, 1), 100) }
  if (status) params.status = status
  if (from) params.from = from
  if (to) params.to = to
  return { params }
}

export const attemptsLabel = (row) => `${row.attempts} of ${row.maxAttempts}`

// The Retry now button: shown only when the server marked the row retryable
// and the viewer may edit. The server checks both again.
export const canRetry = (row, { canEdit }) => !!(canEdit && row?.retryable)

// ── Applicant columns and the details view ────────────────────────────────────

// The applicant line under the application number: name and product when the
// viewer may see applicant data, otherwise why not.
export const applicantLine = (row) => {
  if (row?.applicant) return { name: row.applicant.name, product: row.applicant.product }
  if (row?.applicationMissing) return { name: 'Application no longer exists', product: '' }
  if (row?.applicantHidden) return { name: 'Applicant hidden', product: 'Needs Loan Applications access' }
  return { name: '', product: '' }
}

export const documentCountOf = (row) => {
  const n = row?.applicant ? row.applicant.documentCount : row?.documentCount
  return typeof n === 'number' ? n : null
}

// Recipients as shown in the table: only for an email Microsoft accepted.
export const recipientsLabel = (row) => (row?.status === 'sent' ? (row.recipientSummary || String(row.recipientCount ?? '')) : '—')

// What the preview in the details view is — said plainly, because it is
// rebuilt now and is not a stored copy of the email that went out.
export const previewNotice = (preview) => {
  if (!preview) return null
  const notes = ['This preview is rebuilt now from the application with the current template. It is not a stored copy of the email that was sent.']
  if (!preview.sentTemplateVersion) notes.push('This email was sent before the template version was recorded (it used the earlier, shorter layout), so the email sent looked different.')
  else if (preview.sentTemplateVersion !== preview.templateVersion) notes.push(`The email was sent with template ${preview.sentTemplateVersion}; the preview uses ${preview.templateVersion}.`)
  if (preview.applicationChangedSinceSent) notes.push('The application has changed since the email was built (for example its status), so some values may differ from what was sent.')
  return { severity: notes.length > 1 ? 'warning' : 'info', notes }
}

// One attempt in the delivery history.
export const eventLabel = (event) => {
  const what = statusMeta(event.status).label
  const attempt = event.attempt ? `Attempt ${event.attempt}: ` : ''
  const code = event.code && event.status !== 'sent' ? ` — ${outcomeLabel(event.code)}` : ''
  return `${attempt}${what}${code}`
}
