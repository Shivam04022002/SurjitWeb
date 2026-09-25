import { Box, Typography, Button } from '@mui/material'
import { Lock } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import Loading from './Loading'
import { usePagePermission } from '../hooks/usePermissions'

// Guards a route by the page it belongs to. Typing the address of a page a
// role does not hold gets this rather than the page — and the API behind it
// refuses the same request, so this is the courtesy, not the control.
const RequirePagePermission = ({ page, children }) => {
  const navigate = useNavigate()
  const { canView, loading } = usePagePermission(page)

  if (loading) return <Loading />

  if (!canView) {
    return (
      <Box sx={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2, px: 3, textAlign: 'center'
      }}>
        <Lock sx={{ fontSize: 56, color: 'text.disabled' }} />
        <Typography variant="h6" fontWeight={700}>You do not have access to this page</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          Your role does not include this page. Ask a Super Admin to grant it if you need it.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>Back to dashboard</Button>
      </Box>
    )
  }

  return children
}

export default RequirePagePermission
