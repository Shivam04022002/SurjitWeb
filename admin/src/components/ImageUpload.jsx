import { useRef, useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Avatar,
  IconButton,
  FormHelperText
} from '@mui/material'
import { PhotoCamera, Close } from '@mui/icons-material'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

const megabytes = (bytes) => Math.round((bytes / (1024 * 1024)) * 10) / 10

const ImageUpload = ({
  label = 'Upload Image',
  currentImageUrl = '',
  onChange,
  error = '',
  name = 'image',
  required = false,
  // Some modules are stricter than the 10 MB default — an advertisement image,
  // for one, is capped at 5 MB by the API it is posted to.
  maxSize = MAX_SIZE,
  hint = '',
  // Off where the API has no way to clear a stored image, so the button does
  // not promise something the save cannot carry out.
  allowRemove = true
}) => {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(currentImageUrl || '')
  const [localError, setLocalError] = useState('')

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLocalError('Only JPG, JPEG, PNG, WEBP files are allowed')
      return
    }
    if (file.size > maxSize) {
      setLocalError(`File size must not exceed ${megabytes(maxSize)} MB`)
      return
    }

    setLocalError('')
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    onChange && onChange(file)
  }

  const handleRemove = () => {
    setPreview('')
    if (inputRef.current) inputRef.current.value = ''
    onChange && onChange(null)
  }

  const displayError = localError || error

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: 'red' }}> *</span>}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 100,
            height: 100,
            border: '2px dashed',
            borderColor: displayError ? 'error.main' : 'divider',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            bgcolor: 'grey.50',
            '&:hover': { borderColor: 'primary.main' }
          }}
          onClick={handleClick}
        >
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <PhotoCamera sx={{ fontSize: 36, color: 'grey.400' }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PhotoCamera />}
            onClick={handleClick}
          >
            {preview ? 'Change' : 'Select'} Image
          </Button>

          {preview && allowRemove && (
            <Button
              variant="text"
              size="small"
              color="error"
              startIcon={<Close />}
              onClick={handleRemove}
            >
              Remove
            </Button>
          )}

          <Typography variant="caption" color="text.secondary">
            {hint || `JPG, PNG, WEBP · Max ${megabytes(maxSize)} MB`}
          </Typography>
        </Box>
      </Box>

      {displayError && (
        <FormHelperText error sx={{ mt: 0.5 }}>
          {displayError}
        </FormHelperText>
      )}

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept=".jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </Box>
  )
}

export default ImageUpload
