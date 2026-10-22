import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Drawer, Box, Stack, Typography, IconButton, Chip, Alert, CircularProgress, Divider, Tabs, Tab, Button
} from '@mui/material'
import { Close, OpenInNew } from '@mui/icons-material'
import { emailSettingsService } from '../../services/emailSettings.service'
import { requestErrorMessage } from './emailSettings'
import { statusMeta, outcomeLabel, attemptsLabel, previewNotice, eventLabel } from './emailNotifications'
import DocumentList from '../loanApplications/DocumentList'
import { documentStatus } from '../loanApplications/loanDocuments'

const fmt = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '—')

const Field = ({ label, children }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }} sx={{ py: 0.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 150 }, flexShrink: 0 }}>{label}</Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      {typeof children === 'string' || typeof children === 'number'
        ? <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{children}</Typography>
        : children}
    </Box>
  </Stack>
)

const Section = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
    {children}
  </Box>
)

// The details of one "New Loan Application Received" email: the application
// it was about, what the email contained, its documents and its delivery
// history. Read-only: nothing here sends or resends an email. The application,
// documents and preview are returned by the server only to admins who also
// hold Loan Applications view.
const NotificationDetailsDrawer = ({ notificationId, onClose, showToast }) => {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)

  useEffect(() => {
    if (!notificationId) return undefined
    let cancelled = false
    emailSettingsService.getNotification(notificationId)
      .then((res) => { if (!cancelled) { setData(res.data); setError('') } })
      .catch((err) => { if (!cancelled) setError(requestErrorMessage(err, 'Could not load this notification.')) })
    return () => { cancelled = true }
  }, [notificationId])

  const handleClose = () => {
    setData(null)
    setError('')
    setTab(0)
    onClose()
  }

  const delivery = data?.delivery
  const app = data?.application
  const notice = previewNotice(data?.preview)
  const meta = delivery ? statusMeta(delivery.status) : null

  return (
    <Drawer anchor="right" open={!!notificationId} onClose={handleClose} PaperProps={{ sx: { width: { xs: '100%', md: 760 } } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ flex: 1 }} noWrap>
          {delivery ? `Notification ${delivery.applicationNumber}` : 'Notification'}
        </Typography>
        {meta && <Chip size="small" color={meta.color} label={meta.label} />}
        <IconButton onClick={handleClose} aria-label="Close details"><Close /></IconButton>
      </Stack>

      <Box sx={{ p: 3, overflowY: 'auto' }}>
        {!data && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>}
        {error && <Alert severity="error">{error}</Alert>}

        {data && (
          <>
            <Section title="Application">
              {data.applicantHidden && <Alert severity="info">Applicant details, documents and the email preview need Loan Applications access.</Alert>}
              {data.applicationMissing && <Alert severity="warning">The application this email was about no longer exists.</Alert>}
              {app && (
                <>
                  <Field label="Application">{app.applicationNumber}</Field>
                  <Field label="Applicant">{app.applicantName}</Field>
                  <Field label="Loan product">{app.product}</Field>
                  <Field label="Submitted">{fmt(app.submittedAt)}</Field>
                  <Field label="Current status">{app.status}</Field>
                  <Button size="small" startIcon={<OpenInNew />} sx={{ mt: 1 }} onClick={() => navigate(`/loan-applications?application=${app.id}`)}>
                    Open application
                  </Button>
                </>
              )}
            </Section>

            <Section title="Email">
              <Field label="Recipients">
                {delivery.recipients?.length
                  ? <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{delivery.recipients.join(', ')}</Typography>
                  : <Typography variant="body2" color="text.secondary">{delivery.recipientCount ? `${delivery.recipientCount} (addresses not recorded for older emails)` : '—'}</Typography>}
              </Field>
              <Field label="Subject sent">{delivery.sent?.subject || 'Not recorded (sent before this was kept)'}</Field>
              <Field label="Template">{delivery.sent?.templateVersion || 'Earlier layout (before versions were recorded)'}</Field>
              <Field label="Built">{fmt(delivery.sent?.generatedAt)}</Field>
              {delivery.sent?.fields?.length > 0 && <Field label="Fields included">{`${delivery.sent.fields.length} fields`}</Field>}

              {data.preview && (
                <Box sx={{ mt: 2 }}>
                  {notice && (
                    <Alert severity={notice.severity} sx={{ mb: 1.5 }}>
                      <Typography variant="body2" fontWeight={600}>Regenerated preview — not the exact email sent</Typography>
                      {notice.notes.map((n) => <Typography key={n} variant="body2">{n}</Typography>)}
                    </Alert>
                  )}
                  <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
                    <Tab label="HTML" />
                    <Tab label="Plain text" />
                  </Tabs>
                  {tab === 0 ? (
                    // Fully sandboxed: no script, no forms, no navigation of this page.
                    <Box
                      component="iframe"
                      title="Email preview"
                      sandbox=""
                      srcDoc={data.preview.html}
                      sx={{ width: '100%', height: 640, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: '#f5f5f5' }}
                    />
                  ) : (
                    <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13, maxHeight: 640, overflow: 'auto' }}>
                      {data.preview.text}
                    </Box>
                  )}
                </Box>
              )}
            </Section>

            <Section title="Documents">
              {data.documents
                ? <DocumentList applicationId={app?.id} documents={data.documents} onError={(m) => showToast?.(m, 'error')} dense />
                : delivery.sent?.documents?.length
                  ? (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">As listed in the email when it was built:</Typography>
                      {delivery.sent.documents.map((d) => (
                        <Stack key={d.type} direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ width: 140 }}>{d.label}</Typography>
                          <Chip size="small" label={documentStatus(d.status).label} color={documentStatus(d.status).color} />
                        </Stack>
                      ))}
                    </Stack>
                  )
                  : <Typography variant="body2" color="text.secondary">Not recorded for this email.</Typography>}
            </Section>

            <Section title="Delivery">
              <Field label="Status">{meta?.label}</Field>
              <Field label="Outcome">{outcomeLabel(delivery.outcomeCode) || '—'}</Field>
              {delivery.outcomeCode && <Field label="Outcome code"><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{delivery.outcomeCode}</Typography></Field>}
              <Field label="Attempts">{attemptsLabel(delivery)}</Field>
              <Field label="Created">{fmt(delivery.createdAt)}</Field>
              <Field label="Last attempt">{fmt(delivery.lastAttemptAt)}</Field>
              <Field label="Next attempt">{fmt(delivery.nextAttemptAt)}</Field>
              <Field label="Accepted at">{fmt(delivery.sentAt)}</Field>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>History</Typography>
              {delivery.events?.length
                ? (
                  <Stack spacing={0.5}>
                    {delivery.events.map((e, i) => (
                      <Stack key={`${e.at}-${e.status}-${i}`} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 170 }, flexShrink: 0 }}>{fmt(e.at)}</Typography>
                        <Typography variant="body2">{eventLabel(e)}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                )
                : <Typography variant="body2" color="text.secondary">Not recorded for emails sent before history was kept.</Typography>}
            </Section>
          </>
        )}
      </Box>
    </Drawer>
  )
}

export default NotificationDetailsDrawer
