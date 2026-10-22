// The Share to LinkedIn dialog's decisions, kept apart from the component so
// they can be tested without a browser. The server enforces every rule again;
// these only decide what the admin is shown and which buttons work.

// Mirrors the server's limit (linkedinPublish.service MAX_CAPTION); the
// preview also returns it, which takes precedence.
export const MAX_CAPTION = 2800

// One phase for the dialog, from the preview and the publication record:
//   loading | not_connected | reconnect_required | not_configured |
//   blocked (something else stops publishing) | ready | publishing |
//   published | failed | unknown
export const dialogPhase = (preview, publication) => {
  if (!preview) return 'loading'
  const pub = publication !== undefined ? publication : preview.publication
  if (pub?.status === 'published') return 'published'
  if (pub?.status === 'publishing') return 'publishing'
  if (pub?.status === 'unknown') return 'unknown'
  const state = preview.connection?.state
  if (state === 'not_configured') return 'not_configured'
  if (state === 'not_connected') return 'not_connected'
  if (state === 'reconnect_required') return 'reconnect_required'
  if ((preview.blockers || []).length > 0) return 'blocked'
  if (pub?.status === 'failed') return 'failed'
  return 'ready'
}

export const PHASE_LABELS = {
  loading: 'Loading…',
  not_configured: 'Not configured',
  not_connected: 'Not connected',
  reconnect_required: 'Reconnect required',
  blocked: 'Cannot publish yet',
  ready: 'Ready to publish',
  publishing: 'Publishing…',
  published: 'Published',
  failed: 'Failed — can be retried',
  unknown: 'Outcome unknown'
}

// Only these phases may publish; failed is the explicit retry.
export const canPublish = (phase) => phase === 'ready' || phase === 'failed'

// The caption as the server will see it, and what is wrong with it, if
// anything. `max` defaults to the server's limit.
export const captionProblem = (caption, max = MAX_CAPTION) => {
  const text = String(caption ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) return 'Write a caption for the LinkedIn post.'
  if (text.length > max) return `The caption must be at most ${max} characters (it is ${text.length}).`
  return ''
}

// Publishing needs a valid caption and the explicit confirmation tick —
// opening the dialog or editing the caption never publishes.
export const publishEnabled = ({ phase, caption, confirmed, busy, max }) =>
  canPublish(phase) && confirmed === true && !busy && !captionProblem(caption, max)

// Keep polling while LinkedIn work is still running in the background.
export const shouldPoll = (publication) => publication?.status === 'publishing'

// The error code the server put on a refused request, if any.
export const errorCode = (err) => err?.response?.data?.errors?.[0]?.code || ''

export const errorMessage = (err, fallback = 'Something went wrong.') =>
  err?.response?.data?.message || fallback

// The post URN an admin may record after an uncertain outcome.
export const isPostUrn = (value) => /^urn:li:(share|ugcPost):[0-9]+$/.test(String(value || '').trim())

// The result word LinkedIn's callback leaves on the API page URL.
export const CALLBACK_MESSAGES = {
  connected: ['success', 'LinkedIn connected. Blogs can now be shared to the company page.'],
  cancelled: ['warning', 'LinkedIn sign-in was cancelled. Nothing was changed.'],
  invalid_state: ['error', 'That LinkedIn sign-in link had expired or was already used. Start the connection again.'],
  missing_permission: ['error', 'LinkedIn did not grant the w_organization_social permission. Check the app\'s products in the LinkedIn Developer Portal.'],
  no_role: ['error', 'The LinkedIn member has no posting role on the company page. Sign in as a page admin.'],
  exchange_failed: ['error', 'LinkedIn sign-in could not be completed. See the LinkedIn card for details, then try again.'],
  not_configured: ['error', 'LinkedIn is not configured on the server.'],
  error: ['error', 'LinkedIn sign-in failed unexpectedly. Try again.']
}

export const callbackMessage = (result) => CALLBACK_MESSAGES[result] || null

// What a reconnect reason means to an admin.
export const RECONNECT_REASONS = {
  TOKEN_EXPIRED: 'The authorization expired (LinkedIn issues 60-day tokens).',
  TOKEN_REJECTED: 'LinkedIn rejected the stored authorization — it may have been revoked.',
  REFRESH_REJECTED: 'LinkedIn refused to refresh the authorization.',
  TOKEN_UNREADABLE: 'The stored authorization can no longer be decrypted (the server key changed).',
  ORGANIZATION_CHANGED: 'The configured company page ID changed since this connection was made.',
  CLIENT_CHANGED: 'The LinkedIn app (Client ID) changed since this connection was made; LinkedIn authorizations belong to one app.',
  MISSING_PERMISSION: 'The connection lacks the w_organization_social permission.'
}
