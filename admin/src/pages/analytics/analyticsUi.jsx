// The pieces both analytics pages are built from.
//
// The dashboard and the Traffic by City page show the same kind of thing about
// the same windows, so they share the same cards, the same empty state and —
// above all — the same date filter. One implementation of the range control
// means the two pages cannot drift into disagreeing about what "Last 7 Days"
// offers or how a custom window is bounded.

import { useState } from 'react'
import {
  Box, Card, CardContent, Stack, Typography, Tooltip, Button, TextField, Popover,
  ToggleButton, ToggleButtonGroup
} from '@mui/material'
import { InfoOutlined, CalendarMonth } from '@mui/icons-material'
import { PRESETS, TIMEZONE_LABEL, utcToday } from './analyticsRange'

export const StatCard = ({ label, value, icon: Icon, color, caption, hint }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: `${color}14` }}>
          <Icon fontSize="small" sx={{ color }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
        {hint && (
          <Tooltip title={hint} arrow>
            <InfoOutlined sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        )}
      </Stack>
      <Typography variant="h4" fontWeight={700} lineHeight={1.15}>{value}</Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {caption}
        </Typography>
      )}
    </CardContent>
  </Card>
)

// minWidth 0 lets a grid cell shrink below its content (a wide table then
// scrolls inside the card instead of widening the page).
export const Section = ({ title, subtitle, action, children, sx }) => (
  <Card sx={{ height: '100%', minWidth: 0, ...sx }}>
    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
          {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
        </Box>
        {action}
      </Stack>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </CardContent>
  </Card>
)

export const Empty = ({ children = 'No data available', icon: Icon }) => (
  <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 5, color: 'text.secondary', height: '100%' }}>
    {Icon && <Icon sx={{ color: 'text.disabled' }} />}
    <Typography variant="body2" color="text.secondary" align="center">{children}</Typography>
  </Stack>
)

// ── Custom range picker ──────────────────────────────────────────────────────

export const CustomRangePopover = ({ anchorEl, onClose, initial, onApply }) => {
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const max = utcToday()
  const invalid = !from || !to || from > to || to > max

  return (
    <Popover
      open={!!anchorEl}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Stack spacing={2} sx={{ p: 2, width: 280 }}>
        <Typography variant="subtitle2">Custom range</Typography>
        <TextField
          label="From" type="date" size="small" value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || max } }}
        />
        <TextField
          label="To" type="date" size="small" value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from, max } }}
        />
        <Typography variant="caption" color="text.secondary">Up to 366 days.</Typography>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={onClose}>Cancel</Button>
          <Button size="small" variant="contained" disabled={invalid} onClick={() => onApply({ from, to })}>
            Apply
          </Button>
        </Stack>
      </Stack>
    </Popover>
  )
}

// ── The date filter ──────────────────────────────────────────────────────────
//
// One control, used by both pages: the presets, a custom window, and the line
// stating which window is showing and that it is read in UTC. `children` takes
// whatever else belongs beside it on that page, such as a Refresh button.
export const RangeFilter = ({ range, onChange, rangeLabel, fallbackDays, children }) => {
  const [anchor, setAnchor] = useState(null)

  const onPreset = (_event, value) => {
    // A toggle group hands back null when the pressed button was already on;
    // keeping the current window is better than clearing the filter entirely.
    if (value && value !== 'custom') onChange({ range: value })
  }

  return (
    <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1} sx={{ maxWidth: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ maxWidth: '100%' }}>
        <ToggleButtonGroup
          size="small" exclusive value={range.range} onChange={onPreset}
          sx={{ maxWidth: '100%', overflowX: 'auto' }}
        >
          {PRESETS.map((r) => (
            <ToggleButton key={r.value} value={r.value} sx={{ px: 1.5 }}>{r.label}</ToggleButton>
          ))}
          <ToggleButton value="custom" onClick={(e) => setAnchor(e.currentTarget)} sx={{ px: 1.5 }}>
            <CalendarMonth sx={{ fontSize: 16, mr: 0.5 }} />Custom
          </ToggleButton>
        </ToggleButtonGroup>
        {children}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {rangeLabel && <>{rangeLabel} · </>}
        {TIMEZONE_LABEL}
      </Typography>

      {anchor && (
        <CustomRangePopover
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          initial={{ from: fallbackDays?.from || utcToday(), to: fallbackDays?.to || utcToday() }}
          onApply={({ from, to }) => {
            setAnchor(null)
            onChange({ range: 'custom', from, to })
          }}
        />
      )}
    </Stack>
  )
}
