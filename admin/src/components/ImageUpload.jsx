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

const ImageUpload = ({
  label = 'Upload Image',
  currentImageUrl = '',
  onChange,
  error = '',
  name = 'image',
  required = false
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
    if (file.size > MAX_SIZE) {
      setLocalError('File size must not exceed 10 MB')
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

          {preview && (
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
            JPG, PNG, WEBP · Max 10 MB
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
