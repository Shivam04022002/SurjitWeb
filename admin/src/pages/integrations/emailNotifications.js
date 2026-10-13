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
  NOT_CONFIGURED: 'Email Settings were missing or incomplete',
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
