import { useState } from 'react'
import { Stack, Typography, Chip, Button, CircularProgress, Box } from '@mui/material'
import { OpenInNew, Download } from '@mui/icons-material'
import { loanApplicationService } from '../../services/loanApplication.service'
import { documentStatus, attachedDocuments, opensInline } from './loanDocuments'

// File types (as the server labels them) that open in a browser tab.
const INLINE_FILE_TYPES = new Set(['PDF', 'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'])

// An application's documents: type, file name, status, and an Open button for
// files that are in storage. Opening fetches the file through the API (which
// checks Loan Applications access) and shows it from memory — no storage
// address ever reaches the browser.
const DocumentList = ({ applicationId, documents = [], onError, dense = false }) => {
  const [opening, setOpening] = useState('')

  const open = async (doc) => {
    // A tab for a viewable file is opened now, while the click still counts
    // as the user's action — browsers block pop-ups opened after an await —
    // and pointed at the file once it has arrived. Its link back to this page
    // is cut before the file is shown.
    const viewable = INLINE_FILE_TYPES.has(doc.fileType)
    const tab = viewable ? window.open('about:blank', '_blank') : null
    if (tab) tab.opener = null
    setOpening(doc.type)
    try {
      const blob = await loanApplicationService.getDocument(applicationId, doc.type)
      const url = URL.createObjectURL(blob)
      if (tab && opensInline(blob.type)) {
        tab.location.href = url
      } else {
        tab?.close()
        const a = document.createElement('a')
        a.href = url
        a.download = doc.fileName || doc.type
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
    } catch (err) {
      tab?.close()
      const status = err?.response?.status
      onError?.(status === 404 ? 'That document is no longer available in storage.' : 'The document could not be opened.')
    } finally {
      setOpening('')
    }
  }

  if (!attachedDocuments(documents).length) {
    return <Typography variant="body2" color="text.secondary">No documents were attached to this application.</Typography>
  }

  return (
    <Stack spacing={dense ? 0.75 : 1}>
      {documents.map((d) => {
        const meta = documentStatus(d.status)
        return (
          <Stack key={d.type} direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 1.5 }} alignItems={{ sm: 'center' }}>
            <Typography variant="body2" sx={{ width: { sm: 140 }, flexShrink: 0, fontWeight: 600 }}>{d.label}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }} color={d.fileName ? 'text.primary' : 'text.secondary'}>
                {d.fileName || '—'}{d.fileType ? ` (${d.fileType})` : ''}
              </Typography>
            </Box>
            <Chip size="small" color={meta.color} variant={d.status === 'not_provided' ? 'outlined' : 'filled'} label={meta.label} />
            {meta.openable && (
              <Button
                size="small"
                onClick={() => open(d)}
                disabled={!!opening}
                startIcon={opening === d.type ? <CircularProgress size={14} /> : (INLINE_FILE_TYPES.has(d.fileType) ? <OpenInNew fontSize="small" /> : <Download fontSize="small" />)}
                aria-label={`Open ${d.label}`}
              >
                Open
              </Button>
            )}
          </Stack>
        )
      })}
    </Stack>
  )
}

export default DocumentList
