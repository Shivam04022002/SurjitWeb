import { Chip } from '@mui/material'

const StatusChip = ({ isActive }) => {
  return (
    <Chip
      label={isActive ? 'Active' : 'Inactive'}
      color={isActive ? 'success' : 'default'}
      size="small"
      variant="filled"
    />
  )
}

export default StatusChip
