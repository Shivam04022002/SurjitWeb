import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography,
  Chip, Box, Divider, useMediaQuery, useTheme
} from '@mui/material'
import { LEVELS } from './permissionMatrix'

// What a role can reach, read-only. Only the pages it holds are listed: a list
// of everything it cannot reach would be longer and say less.
const RoleDetailDialog = ({ role, catalogue, onClose }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  if (!role) return null

  const modules = (catalogue?.modules || [])
    .map((group) => ({
      module: group.module,
      pages: group.pages.filter((p) => (role.levels?.[p.key] || LEVELS.NONE) !== LEVELS.NONE)
    }))
    .filter((group) => group.pages.length > 0)

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle>{role.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={role.status}
              color={role.status === 'Active' ? 'success' : 'default'}
              variant={role.status === 'Active' ? 'filled' : 'outlined'}
            />
            {role.isSystem && <Chip size="small" variant="outlined" label="Built in" />}
            <Chip size="small" variant="outlined" label={`${role.userCount} user${role.userCount === 1 ? '' : 's'}`} />
          </Stack>

          {role.description && <Typography variant="body2" color="text.secondary">{role.description}</Typography>}

          <Divider />

          {modules.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              This role has no pages yet, so its users see nothing but the dashboard.
            </Typography>
          )}

          {modules.map((group) => (
            <Box key={group.module}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                {group.module}
              </Typography>
              <Stack sx={{ mt: 0.5 }}>
                {group.pages.map((page) => {
                  const level = role.levels[page.key]
                  return (
                    <Box
                      key={page.key}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        py: 0.75, borderBottom: '1px solid', borderColor: 'divider'
                      }}
                    >
                      <Typography variant="body2">{page.label}</Typography>
                      <Chip
                        size="small"
                        label={level === LEVELS.EDIT ? 'Edit' : 'View'}
                        color={level === LEVELS.EDIT ? 'primary' : 'default'}
                        variant={level === LEVELS.EDIT ? 'filled' : 'outlined'}
                      />
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default RoleDetailDialog
