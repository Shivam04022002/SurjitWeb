import { Alert } from '@mui/material'
import { usePermissions } from '../hooks/usePermissions'

// Says plainly that this page is read-only for this role, on pages where the
// absence of a Save button would otherwise just look like something missing.
//
// It renders nothing when the role may edit, so a page can include it
// unconditionally.
const ReadOnlyNotice = ({ what = 'this page', sx }) => {
  const { canView, canEdit } = usePermissions()
  if (!canView || canEdit) return null

  return (
    <Alert severity="info" sx={{ mb: 2, ...sx }}>
      You have read-only access to {what}. Changes need edit access — ask a Super Admin.
    </Alert>
  )
}

export default ReadOnlyNotice
