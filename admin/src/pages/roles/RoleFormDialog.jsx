import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack,
  Typography, Checkbox, Box, Divider, CircularProgress, Alert, MenuItem,
  useMediaQuery, useTheme
} from '@mui/material'
import { roleService } from '../../services/role.service'
import {
  LEVELS, isViewChecked, isEditChecked, toggleView, toggleEdit,
  setLevel, setModuleLevel, moduleState, levelsFromCatalogue,
  grantedLevels, validateRoleForm, roleError
} from './permissionMatrix'

const EMPTY = { name: '', description: '', status: 'Active' }

// Create or edit a role: its name, and the two boxes per page that decide what
// its users can reach.
//
// The pairing is enforced as the boxes are ticked — Edit brings View with it,
// and clearing View clears Edit — because the server stores the same pairing
// and would otherwise refuse what the form had offered.
const RoleFormDialog = ({ role, catalogue, onClose, onSaved, onError }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Mounted per role (the list keys it on the role's id), so the starting
  // state is read once from the role being edited rather than synced into
  // place afterwards.
  const [form, setForm] = useState(() => (role
    ? { name: role.name || '', description: role.description || '', status: role.status || 'Active' }
    : EMPTY))
  const [levels, setLevels] = useState(() => levelsFromCatalogue(catalogue, role?.levels))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const found = validateRoleForm(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        permissions: grantedLevels(levels)
      }
      if (role) {
        await roleService.updateRole(role._id, payload)
        onSaved('Role updated')
      } else {
        await roleService.createRole(payload)
        onSaved('Role created')
      }
    } catch (err) {
      onError(roleError(err, 'Failed to save role'))
    } finally {
      setSaving(false)
    }
  }

  const modules = catalogue?.modules || []

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>{role ? `Edit ${role.name}` : 'Add Role'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Role Name" required fullWidth value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((x) => ({ ...x, name: '' })) }}
              error={!!errors.name}
              helperText={errors.name || 'Shown wherever a user’s role appears'}
              inputProps={{ maxLength: 60 }}
            />
            <TextField
              select label="Status" value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              sx={{ minWidth: { sm: 160 } }}
              helperText="An inactive role grants nothing"
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Inactive">Inactive</MenuItem>
            </TextField>
          </Stack>

          <TextField
            label="Description" fullWidth multiline minRows={2} value={form.description}
            onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value })); setErrors((x) => ({ ...x, description: '' })) }}
            error={!!errors.description}
            helperText={errors.description || 'What this role is for'}
            inputProps={{ maxLength: 250 }}
          />

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Permissions</Typography>
            <Typography variant="caption" color="text.secondary">
              View opens the page and reads it. Edit also allows changes, and includes View.
            </Typography>
          </Box>

          {!catalogue && <Alert severity="warning">The page list could not be loaded.</Alert>}

          {modules.map((group) => {
            const pageKeys = group.pages.map((p) => p.key)
            const state = moduleState(levels, pageKeys)

            return (
              <Box key={group.module} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                  bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider'
                }}>
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>{group.module}</Typography>

                  <Box sx={{ width: 74, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">View</Typography>
                    <Checkbox
                      size="small"
                      checked={state.allView}
                      indeterminate={state.someView}
                      onChange={() => setLevels((l) => setModuleLevel(l, pageKeys, state.allView ? LEVELS.NONE : LEVELS.VIEW))}
                      inputProps={{ 'aria-label': `View all pages in ${group.module}` }}
                    />
                  </Box>
                  <Box sx={{ width: 74, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Edit</Typography>
                    <Checkbox
                      size="small"
                      checked={state.allEdit}
                      indeterminate={state.someEdit}
                      onChange={() => setLevels((l) => setModuleLevel(l, pageKeys, state.allEdit ? LEVELS.VIEW : LEVELS.EDIT))}
                      inputProps={{ 'aria-label': `Edit all pages in ${group.module}` }}
                    />
                  </Box>
                </Box>

                {group.pages.map((page) => (
                  <Box
                    key={page.key}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
                      '&:not(:last-of-type)': { borderBottom: '1px solid', borderColor: 'divider' }
                    }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>{page.label}</Typography>

                    <Box sx={{ width: 74, textAlign: 'center' }}>
                      <Checkbox
                        size="small"
                        checked={isViewChecked(levels[page.key])}
                        onChange={() => setLevels((l) => setLevel(l, page.key, toggleView(l[page.key])))}
                        inputProps={{ 'aria-label': `View ${page.label}` }}
                      />
                    </Box>
                    <Box sx={{ width: 74, textAlign: 'center' }}>
                      <Checkbox
                        size="small"
                        checked={isEditChecked(levels[page.key])}
                        onChange={() => setLevels((l) => setLevel(l, page.key, toggleEdit(l[page.key])))}
                        inputProps={{ 'aria-label': `Edit ${page.label}` }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            )
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {role ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RoleFormDialog
