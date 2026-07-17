import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  CircularProgress,
  IconButton,
  Typography,
  MenuItem
} from '@mui/material'
import { Close } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import ImageUpload from '../../components/ImageUpload'
import { TEAM_TYPES, TEAM_TYPE_OPTIONS } from '../../utils/constants'

const defaultValues = {
  name: '',
  designation: '',
  description: '',
  displayOrder: 0,
  isActive: true,
  teamType: TEAM_TYPES.LEADERSHIP
}

const LeadershipFormDialog = ({ open, member, onSave, onClose, saving }) => {
  const [photoFile, setPhotoFile] = useState(null)
  const isEdit = !!member

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({ defaultValues })

  useEffect(() => {
    if (open) {
      setPhotoFile(null)
      if (member) {
        reset({
          name: member.name || '',
          designation: member.designation || '',
          description: member.description || '',
          displayOrder: member.displayOrder ?? 0,
          isActive: member.isActive ?? true,
          teamType: TEAM_TYPES.LEADERSHIP
        })
      } else {
        reset(defaultValues)
      }
    }
  }, [open, member, reset])

  const onSubmit = ({ teamType, ...data }) => {
    const formData = new FormData()
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) formData.append(key, val)
    })
    if (photoFile) formData.append('photo', photoFile)

    // teamType is not a LeadershipMember field — a change to it is a move
    // between collections, handled by the transfer endpoint.
    const targetTeam = isEdit && teamType !== TEAM_TYPES.LEADERSHIP ? teamType : null
    onSave(formData, targetTeam)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>
          {isEdit ? 'Edit Leadership Member' : 'Add Leadership Member'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12}>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name *"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="designation"
              control={control}
              rules={{ required: 'Designation is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Designation *"
                  fullWidth
                  error={!!errors.designation}
                  helperText={errors.designation?.message}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Description" fullWidth multiline rows={3} />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="teamType"
              control={control}
              rules={{ required: 'Team is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Team *"
                  fullWidth
                  disabled={!isEdit}
                  error={!!errors.teamType}
                  helperText={
                    errors.teamType?.message ||
                    (isEdit
                      ? 'Changing the team moves this member to that page. No duplicate is created.'
                      : 'The member is added to the Leadership Team. You can move them after saving.')
                  }
                >
                  {TEAM_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="displayOrder"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Display Order"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <ImageUpload
              label="Photo"
              currentImageUrl={member?.photo?.url || ''}
              onChange={setPhotoFile}
              name="photo"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default LeadershipFormDialog
