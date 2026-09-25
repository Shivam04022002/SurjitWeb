import { Box } from '@mui/material'
import { usePermissions } from '../hooks/usePermissions'

// Makes an editing surface read-only for a role that may only view it.
//
// A page with a handful of controls can gate each one on `perms.canEdit`. A
// page built from tabs and sub-forms has too many places to remember, so this
// wraps the whole surface in a disabled fieldset: the browser then disables
// every input, select, file picker and button inside it, including ones added
// later. Nothing has to be listed, and nothing can be missed.
//
// Navigation stays outside the wrapper, so the page is still readable and its
// tabs still switch. The API refuses these actions regardless — this is what
// spares an administrator from filling in a form that was never going to save.
const ReadOnlyGuard = ({ children, sx }) => {
  const { canEdit } = usePermissions()

  if (canEdit) return children

  return (
    <Box
      component="fieldset"
      disabled
      aria-describedby="read-only-page"
      sx={{
        border: 0,
        p: 0,
        m: 0,
        minWidth: 0,
        // A disabled fieldset already blocks interaction; this makes it look
        // deliberate rather than broken.
        opacity: 0.85,
        ...sx
      }}
    >
      {children}
    </Box>
  )
}

export default ReadOnlyGuard
