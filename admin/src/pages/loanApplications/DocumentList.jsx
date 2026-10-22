import { useState } from 'react'
import { Stack, Typography, Chip, Button, CircularProgress, Box } from '@mui/material'
import { OpenInNew, Download } from '@mui/icons-material'
import { loanApplicationService } from '../../services/loanApplication.service'
import { documentStatus, attachedDocuments } from './loanDocuments'
import { showFile, fileErrorMessage } from '../../utils/privateFiles'

// File types (as the server labels them) that open in a browser tab.
const INLINE_FILE_TYPES = new Set(['PDF', 'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'])

// An application's documents: type, file name, status, and an Open button for
// files that are in storage. Opening fetches the file through the API (which
// checks Loan Applications access) and shows it from memory — no storage
// address ever reaches the browser.
const DocumentList = ({ applicationId, documents = [], onError, dense = false }) => {
  const [opening, setOpening] = useState('')

  // Nothing is opened until the file has arrived, so a refused or failed
  // request never leaves a blank tab behind.
  const open = async (doc) => {
    setOpening(doc.type)
    try {
      const blob = await loanApplicationService.getDocument(applicationId, doc.type)
      showFile(blob, doc.fileName || doc.type)
    } catch (err) {
      onError?.(fileErrorMessage(err?.response?.status, 'document'))
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
