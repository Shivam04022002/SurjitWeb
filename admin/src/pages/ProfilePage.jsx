import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material'
import { useAuth } from '../hooks/useAuth'
import { authService } from '../services/auth.service'
import { changePasswordSchema } from '../utils/validation'
import { ROLE_LABELS } from '../utils/constants'

const ProfilePage = () => {
  const { user, logout } = useAuth()
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: ''
    }
  })

  const onChangePassword = async (data) => {
    try {
      setLoading(true)
      setMessage({ type: '', text: '' })
      await authService.changePassword(data)
      reset()
      setMessage({ type: 'success', text: 'Password changed successfully. Please log in again.' })
      setTimeout(() => logout(), 2000)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
        Profile
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Personal Information
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <TextField
                fullWidth
                label="Name"
                margin="normal"
                value={user?.name || ''}
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="Email"
                margin="normal"
                value={user?.email || ''}
                InputProps={{ readOnly: true }}
              />
              <TextField
                fullWidth
                label="Role"
                margin="normal"
                value={ROLE_LABELS[user?.role] || user?.role || ''}
                InputProps={{ readOnly: true }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Change Password
              </Typography>
              <Divider sx={{ mb: 3 }} />
              <form onSubmit={handleSubmit(onChangePassword)}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type="password"
                  margin="normal"
                  {...register('currentPassword')}
                  error={Boolean(errors.currentPassword)}
                  helperText={errors.currentPassword?.message}
                />
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  margin="normal"
                  {...register('newPassword')}
                  error={Boolean(errors.newPassword)}
                  helperText={errors.newPassword?.message}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="secondary"
                  sx={{ mt: 2 }}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ProfilePage
