import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack,
  Typography, Chip, Alert, Box, Checkbox, FormControlLabel, CircularProgress, Link, Divider
} from '@mui/material'
import { LinkedIn, OpenInNew } from '@mui/icons-material'
import api from '../../services/api'
import { linkedinService } from '../../services/linkedin.service'
import {
  MAX_CAPTION, dialogPhase, PHASE_LABELS, canPublish, captionProblem, publishEnabled,
  shouldPoll, errorCode, errorMessage, isPostUrn
} from './linkedinShare'

const POLL_MS = 2000

const PHASE_COLORS = {
  ready: 'primary', publishing: 'info', published: 'success', failed: 'error',
  unknown: 'warning', reconnect_required: 'warning', not_connected: 'default',
  not_configured: 'default', blocked: 'warning', loading: 'default'
}

const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

// Local uploads are served by the API ("/uploads/..."); S3 images are absolute.
const imageSrc = (url) => {
  if (!url || !url.startsWith('/')) return url
  try { return `${new URL(api.defaults.baseURL).origin}${url}` } catch { return url }
}

// Share to LinkedIn for one published blog: preview, edit the caption,
// confirm, publish — then follow the background publication to its outcome.
// Opening the dialog or editing the caption sends nothing to LinkedIn.
const LinkedInShareDialog = ({ open, blog, onClose, showToast }) => {
  const [preview, setPreview] = useState(null)
  const [publication, setPublication] = useState(undefined)
  const [loadError, setLoadError] = useState('')
  const [caption, setCaption] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [postUrn, setPostUrn] = useState('')
  // Bumped to try again after a failed status read.
  const [pollTick, setPollTick] = useState(0)
  // The parent passes a new showToast on every render; reading it through a
  // ref keeps the effects below from re-running (and the dialog resetting)
  // on a parent re-render.
  const toastRef = useRef(showToast)
  useEffect(() => { toastRef.current = showToast }, [showToast])

  const load = useCallback(async () => {
    if (!blog) return
    setPreview(null)
    setPublication(undefined)
    setLoadError('')
    setActionError('')
    setConfirmed(false)
    setPostUrn('')
    try {
      const res = await linkedinService.getPreview(blog._id)
      const p = res.data.preview
      setPreview(p)
      setCaption(p.publication?.caption || p.defaultCaption || '')
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not prepare the LinkedIn preview.'))
    }
  }, [blog])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const phase = loadError ? 'blocked' : dialogPhase(preview, publication)
  const pub = publication !== undefined ? publication : preview?.publication

  // While the server is still publishing, read the record again every couple
  // of seconds. Each new record re-runs this; closing the dialog or reaching
  // an outcome cancels the pending read.
  useEffect(() => {
    if (!open || !blog || !shouldPoll(pub)) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await linkedinService.getPublication(blog._id)
        if (cancelled) return
        const next = res.data.publication
        setPublication(next)
        if (next?.status === 'published') toastRef.current('Published to LinkedIn')
      } catch {
        if (!cancelled) setPollTick((t) => t + 1)
      }
    }, POLL_MS)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, blog, pub, pollTick])
  const max = preview?.maxCaptionLength || MAX_CAPTION
  const problem = captionProblem(caption, max)
  const editable = canPublish(phase) && !busy

  const handlePublish = async () => {
    if (!publishEnabled({ phase, caption, confirmed, busy, max })) return
    setBusy(true)
    setActionError('')
    try {
      const res = await linkedinService.publish(blog._id, caption)
      setPublication(res.data.publication)
      setConfirmed(false)
    } catch (err) {
      const code = errorCode(err)
      setActionError(errorMessage(err, 'Could not start publishing.'))
      // The record changed under us (another tab, another admin): show it.
      if (['ALREADY_PUBLISHED', 'PUBLISH_IN_PROGRESS', 'OUTCOME_UNKNOWN'].includes(code)) {
        try {
          const res = await linkedinService.getPublication(blog._id)
          setPublication(res.data.publication)
        } catch { /* keep the message */ }
      }
    } finally {
      setBusy(false)
    }
  }

  const handleResolve = async (outcome) => {
    setBusy(true)
    setActionError('')
    try {
      const res = await linkedinService.resolve(blog._id, outcome, outcome === 'published' ? postUrn.trim() : undefined)
      setPublication(res.data.publication)
      toastRef.current(outcome === 'published' ? 'Recorded as published on LinkedIn' : 'Recorded as not published; it can be shared again')
    } catch (err) {
      setActionError(errorMessage(err, 'Could not record the outcome.'))
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => onClose()

  return (
    <Dialog open={open} onClose={busy ? undefined : handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <LinkedIn sx={{ color: '#0a66c2' }} />
        Share to LinkedIn
        <Chip size="small" sx={{ ml: 'auto' }} color={PHASE_COLORS[phase] || 'default'} label={PHASE_LABELS[phase] || phase} />
      </DialogTitle>
      <DialogContent dividers>
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {!loadError && !preview && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        )}

        {preview && (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">Destination:</Typography>
              <Chip size="small" icon={<LinkedIn />} label={preview.destination.label} />
              {preview.destination.organizationId && (
                <Typography variant="caption" color="text.secondary">{preview.destination.organizationUrn}</Typography>
              )}
            </Stack>

            {['not_connected', 'not_configured', 'reconnect_required'].includes(phase) && (
              <Alert severity="warning">
                {phase === 'reconnect_required'
                  ? 'The LinkedIn connection must be renewed before anything can be published.'
                  : 'LinkedIn is not connected yet.'}{' '}
                An admin with API Settings access can {phase === 'reconnect_required' ? 'reconnect' : 'connect'} it under
                {' '}<Link href="/integrations/api">API Settings → LinkedIn</Link>.
              </Alert>
            )}
            {phase === 'blocked' && preview.blockers.map((b) => (
              <Alert key={b.code} severity="warning">{b.message}</Alert>
            ))}

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              {preview.image.url
                ? <Box component="img" src={imageSrc(preview.image.url)} alt="" sx={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block', bgcolor: 'grey.100' }} />
                : <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary', bgcolor: 'grey.50' }}>No featured image</Box>}
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>{preview.blog.title}</Typography>
                {preview.canonicalUrl
                  ? <Link href={preview.canonicalUrl} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>{preview.canonicalUrl}</Link>
                  : <Typography variant="body2" color="error">Public address unavailable</Typography>}
              </Box>
            </Box>

            <TextField
              label="LinkedIn caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={!editable}
              multiline
              minRows={4}
              maxRows={12}
              fullWidth
              error={editable && !!problem}
              helperText={(editable && problem) || `${caption.length} / ${max} — posted above the link. The blog itself is not changed. Words starting with # become hashtags.`}
            />

            {pub?.status === 'published' && (
              <Alert severity="success">
                Published to LinkedIn on {fmtDateTime(pub.publishedAt)}{pub.publishedBy ? ` by ${pub.publishedBy.name}` : ''}.{' '}
                {pub.postUrl
                  ? <Link href={pub.postUrl} target="_blank" rel="noopener noreferrer">View the post <OpenInNew sx={{ fontSize: 14, verticalAlign: 'middle' }} /></Link>
                  : <>Post ID: <code>{pub.postUrn}</code> (find it on the company page's Posts tab).</>}
              </Alert>
            )}
            {pub?.status === 'publishing' && (
              <Alert severity="info" icon={<CircularProgress size={18} />}>
                Publishing… ({pub.stage?.replace(/_/g, ' ')}). This continues on the server even if this dialog is closed.
              </Alert>
            )}
            {pub?.status === 'failed' && pub.error && (
              <Alert severity="error">
                The last attempt failed and nothing was published: {pub.error.message} You can publish again.
              </Alert>
            )}
            {pub?.status === 'unknown' && (
              <Alert severity="warning">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {pub.error?.message || 'LinkedIn did not confirm the post.'} To avoid a duplicate, it will not be retried automatically.
                  Check the company page's posts, then record what you found.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => handleResolve('not_published')}>
                    Not on LinkedIn — allow retry
                  </Button>
                  <TextField
                    size="small" placeholder="urn:li:share:…" value={postUrn}
                    onChange={(e) => setPostUrn(e.target.value)} sx={{ flex: 1, minWidth: 180 }}
                  />
                  <Button size="small" variant="outlined" disabled={busy || !isPostUrn(postUrn)} onClick={() => handleResolve('published')}>
                    It is on LinkedIn
                  </Button>
                </Stack>
              </Alert>
            )}

            {actionError && <Alert severity="error">{actionError}</Alert>}

            {canPublish(phase) && (
              <>
                <Divider />
                <FormControlLabel
                  control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={busy} />}
                  label={`I confirm this post will be published publicly to the ${preview.destination.label} on LinkedIn.`}
                />
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>{pub?.status === 'published' ? 'Close' : 'Cancel'}</Button>
        {canPublish(phase) && (
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <LinkedIn />}
            disabled={!publishEnabled({ phase, caption, confirmed, busy, max })}
            onClick={handlePublish}
          >
            {phase === 'failed' ? 'Retry publish' : 'Publish to LinkedIn'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default LinkedInShareDialog
