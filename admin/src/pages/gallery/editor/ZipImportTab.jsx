import { useState, useRef } from 'react'
import {
  Box, Typography, Button, Paper, LinearProgress, Stack,
  Alert, Divider, List, ListItem, ListItemText, Chip,
  Grid, Card, CardMedia, CircularProgress
} from '@mui/material'
import { FolderZip, CloudUpload, CheckCircle, Warning } from '@mui/icons-material'
import { galleryService } from '../../../services/gallery.service'

const MAX_ZIP_MB = 200

const ZipImportTab = ({ albumId, showToast, onImportComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      showToast('Only ZIP files are allowed', 'error')
      return
    }
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > MAX_ZIP_MB) {
      showToast(`ZIP file exceeds ${MAX_ZIP_MB} MB limit`, 'error')
      return
    }
    setSelectedFile(file)
    setResult(null)
    setUploadProgress(0)
  }

  const handleImport = async () => {
    if (!selectedFile) return
    setUploading(true)
    setUploadProgress(0)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('zipFile', selectedFile)

      const res = await galleryService.importZip(albumId, fd, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
        setUploadProgress(pct)
      })

      setResult(res.data)
      showToast(`Import complete: ${res.data.uploaded} images uploaded`)
      if (onImportComplete) onImportComplete()
    } catch (err) {
      showToast(err?.response?.data?.message || 'ZIP import failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setResult(null)
    setUploadProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>ZIP Import</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a ZIP file containing images. Supported formats: JPG, JPEG, PNG, WEBP.
        Hidden files, Thumbs.db and unsupported formats are automatically ignored.
        Nested folders are supported. Max ZIP size: {MAX_ZIP_MB} MB · Max per image: 15 MB.
      </Typography>

      {/* Drop zone */}
      <Paper
        variant="outlined"
        sx={{
          p: 4, mb: 3, borderRadius: 2, borderStyle: 'dashed',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
          bgcolor: 'grey.50', cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' }
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".zip"
          onChange={handleFileSelect}
        />
        <FolderZip sx={{ fontSize: 48, color: selectedFile ? 'primary.main' : 'grey.400' }} />

        {selectedFile ? (
          <>
            <Typography variant="body1" fontWeight={600}>{selectedFile.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body1" fontWeight={500}>Click to select a ZIP file</Typography>
            <Typography variant="caption" color="text.secondary">Max {MAX_ZIP_MB} MB</Typography>
          </>
        )}
      </Paper>

      {/* Upload progress */}
      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2">Uploading & extracting...</Typography>
            <Typography variant="body2">{uploadProgress}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1, height: 8 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Large ZIPs may take a moment to process on the server after upload.
          </Typography>
        </Box>
      )}

      {/* Action buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
          onClick={handleImport}
          disabled={!selectedFile || uploading}
        >
          {uploading ? 'Importing...' : 'Start Import'}
        </Button>
        {selectedFile && !uploading && (
          <Button variant="outlined" onClick={handleReset}>Clear</Button>
        )}
      </Stack>

      {/* Result summary */}
      {result && (
        <Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Import Summary</Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              icon={<CheckCircle />}
              label={`${result.uploaded} Uploaded`}
              color="success"
              variant="filled"
            />
            <Chip
              label={`${result.skipped} Skipped`}
              color="warning"
              variant="outlined"
            />
            {result.failed > 0 && (
              <Chip
                icon={<Warning />}
                label={`${result.failed} Failed`}
                color="error"
                variant="filled"
              />
            )}
          </Stack>

          {/* Skipped files */}
          {result.skippedFiles?.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Skipped files:</Typography>
              <List dense disablePadding>
                {result.skippedFiles.map((f, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText
                      primary={f.name}
                      secondary={f.reason?.replace(/_/g, ' ')}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {/* Failed files */}
          {result.failedFiles?.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Failed files:</Typography>
              <List dense disablePadding>
                {result.failedFiles.map((f, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0 }}>
                    <ListItemText
                      primary={f.name}
                      secondary={f.reason}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}

          {/* Preview imported images */}
          {result.images?.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Imported images preview:</Typography>
              <Grid container spacing={1.5}>
                {result.images.slice(0, 24).map((img) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={img._id}>
                    <Card variant="outlined">
                      <CardMedia
                        component="img"
                        height="100"
                        image={img.image.url}
                        alt={img.altText || 'imported'}
                        sx={{ objectFit: 'cover', bgcolor: 'grey.100' }}
                      />
                    </Card>
                  </Grid>
                ))}
                {result.images.length > 24 && (
                  <Grid item xs={6} sm={4} md={3} lg={2}>
                    <Box
                      sx={{
                        height: 100, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'grey.100',
                        borderRadius: 1, border: '1px solid', borderColor: 'divider'
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        +{result.images.length - 24} more
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

export default ZipImportTab
