import { useState, useRef, useLayoutEffect } from 'react'
import { Box, Stack, Typography, useTheme } from '@mui/material'
import { SERIES, nf } from './chartTheme'

// Small inline-SVG charts rather than a charting dependency. The admin bundle
// is already large, and these need a handful of series over at most ~366
// points.

// Whole-number axis steps of 1, 2 or 5 × 10ⁿ — counts never need fractions.
const niceTicks = (maxValue, target = 4) => {
  const raw = Math.max(1, maxValue) / target
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow)
  const top = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

// Width of the container in CSS pixels, so the chart draws at real size and
// text never scales with the viewport.
const useWidth = () => {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export const LegendKey = ({ color, label, variant = 'line' }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    <Box
      sx={variant === 'line'
        ? { width: 14, height: 2, bgcolor: color, borderRadius: 1 }
        : { width: 10, height: 10, bgcolor: color, borderRadius: '3px' }}
    />
    <Typography variant="caption" color="text.secondary">{label}</Typography>
  </Stack>
)

// Multi-series line chart over a daily series, with a crosshair that snaps to
// the nearest day and a tooltip listing every series at that day. Arrow keys
// move the crosshair when the chart has focus.
//
//   data:   [{ date: 'YYYY-MM-DD', ...values }]
//   series: [{ key, label, color }]
export const LineChart = ({ data, series, height = 260, formatDate, area = false, ariaLabel }) => {
  const theme = useTheme()
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)

  const padL = 40
  const padR = 16
  const padT = 12
  const padB = 28
  const plotW = Math.max(0, width - padL - padR)
  const plotH = height - padT - padB

  const maxVal = Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] || 0)))
  const { top, ticks } = niceTicks(maxVal)
  const n = data.length
  const x = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
  const y = (v) => padT + plotH - (v / top) * plotH

  const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key] || 0).toFixed(1)}`).join('')

  // Roughly one date label per 90px, always including the last day.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 90))))
  const showLabel = (i) => (n - 1 - i) % labelEvery === 0

  const indexAt = (clientX) => {
    const rect = ref.current.getBoundingClientRect()
    const px = clientX - rect.left - padL
    if (n <= 1) return 0
    return Math.min(n - 1, Math.max(0, Math.round((px / plotW) * (n - 1))))
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setActive((i) => {
        const cur = i == null ? n - 1 : i
        return Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowLeft' ? -1 : 1)))
      })
    } else if (e.key === 'Escape') {
      setActive(null)
    }
  }

  const activeRow = active != null ? data[active] : null
  const tipLeft = active != null ? x(active) : 0
  const flip = tipLeft > width - 180

  return (
    <Box>
      <Box
        ref={ref}
        sx={{ position: 'relative', width: '100%', height, outline: 'none', '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}`, borderRadius: 1 } }}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={(e) => width && setActive(indexAt(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((i) => (i == null ? n - 1 : i))}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {width > 0 && (
          <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke={theme.palette.divider} strokeWidth="1" />
                <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary}>
                  {nf.format(v)}
                </text>
              </g>
            ))}

            {data.map((d, i) => showLabel(i) && (
              <text
                key={d.date} x={x(i)} y={height - 8}
                textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                fontSize="11" fill={theme.palette.text.secondary}
              >
                {formatDate(d.date)}
              </text>
            ))}

            {area && series[0] && n > 1 && (
              <path
                d={`${path(series[0].key)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`}
                fill={series[0].color} opacity="0.1"
              />
            )}

            {n > 1 && series.map((s) => (
              <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {/* A single day has no line to draw, so it gets a visible point. */}
            {n === 1 && series.map((s) => (
              <circle key={s.key} cx={x(0)} cy={y(data[0][s.key] || 0)} r="4" fill={s.color} />
            ))}

            {activeRow && (
              <g pointerEvents="none">
                <line x1={x(active)} x2={x(active)} y1={padT} y2={padT + plotH} stroke={theme.palette.text.secondary} strokeWidth="1" opacity="0.5" />
                {series.map((s) => (
                  <circle
                    key={s.key} cx={x(active)} cy={y(activeRow[s.key] || 0)} r="4"
                    fill={s.color} stroke={theme.palette.background.paper} strokeWidth="2"
                  />
                ))}
              </g>
            )}
          </svg>
        )}

        {activeRow && (
          <Box
            sx={{
              position: 'absolute',
              top: padT,
              left: flip ? undefined : tipLeft + 12,
              right: flip ? width - tipLeft + 12 : undefined,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5,
              boxShadow: 3,
              px: 1.5,
              py: 1,
              pointerEvents: 'none',
              minWidth: 140,
              zIndex: 1
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {formatDate(activeRow.date, true)}
            </Typography>
            {series.map((s) => (
              <Stack key={s.key} direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 10, height: 2, bgcolor: s.color, borderRadius: 1, flexShrink: 0 }} />
                <Typography variant="body2" fontWeight={700}>{nf.format(activeRow[s.key] || 0)}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>

      {series.length > 1 && (
        <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5, pl: `${padL}px` }}>
          {series.map((s) => <LegendKey key={s.key} color={s.color} label={s.label} />)}
        </Stack>
      )}
    </Box>
  )
}

// Donut for part-to-whole over a few categories. The centre shows the total,
// or the hovered/focused segment. The legend beside it always carries every
// value and percentage, so nothing depends on hovering or on colour alone.
//
//   items: [{ key, label, value, color }]
export const DonutChart = ({ items, size = 168, thickness = 22, totalLabel = 'Total' }) => {
  const theme = useTheme()
  const [hover, setHover] = useState(null)
  const total = items.reduce((n, i) => n + i.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const visible = items.filter((i) => i.value > 0)
  // A 2px gap between segments, unless one segment is the whole ring.
  const gap = visible.length > 1 ? 2 : 0

  const segments = visible.reduce((acc, item) => {
    const offset = acc.length ? acc[acc.length - 1].end : 0
    const len = (item.value / total) * c
    acc.push({ ...item, dash: Math.max(0, len - gap), offset, end: offset + len })
    return acc
  }, [])

  const focus = hover ? items.find((i) => i.key === hover) : null
  const pct = (v) => (total ? `${Math.round((v / total) * 100)}%` : '0%')

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} role="img" aria-label={`${totalLabel}: ${items.map((i) => `${i.label} ${i.value}`).join(', ')}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.palette.action.hover} strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.key ? thickness + 4 : thickness}
                strokeDasharray={`${s.dash} ${c - s.dash}`}
                strokeDashoffset={-s.offset}
                style={{ transition: 'stroke-width 120ms', cursor: 'default' }}
                pointerEvents="stroke"
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        <Stack sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} alignItems="center" justifyContent="center">
          <Typography variant="h5" fontWeight={700} lineHeight={1.1}>
            {nf.format(focus ? focus.value : total)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {focus ? `${focus.label} · ${pct(focus.value)}` : totalLabel}
          </Typography>
        </Stack>
      </Box>

      <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
        {items.map((i) => (
          <Stack
            key={i.key}
            direction="row"
            alignItems="center"
            spacing={1}
            tabIndex={0}
            onPointerEnter={() => setHover(i.key)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i.key)}
            onBlur={() => setHover(null)}
            sx={{
              px: 1, py: 0.5, borderRadius: 1, outline: 'none',
              bgcolor: hover === i.key ? 'action.hover' : 'transparent',
              opacity: i.value === 0 ? 0.55 : 1
            }}
          >
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: i.color, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flex: 1 }}>{i.label}</Typography>
            <Typography variant="body2" fontWeight={600}>{nf.format(i.value)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: 'right' }}>
              {pct(i.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

// Ranked horizontal bars as plain rows: label, value, share, and a thin bar.
// Magnitude is the only thing encoded, so one hue throughout.
//
//   items: [{ key, label, value }]
export const BarList = ({ items, color = SERIES.blue, showShare = true, emptyText = 'No data available' }) => {
  const total = items.reduce((n, i) => n + i.value, 0)
  const max = Math.max(0, ...items.map((i) => i.value))
  if (!total) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{emptyText}</Typography>
  }
  return (
    <Stack spacing={1.5}>
      {items.map((i) => (
        <Box key={i.key} sx={{ opacity: i.value === 0 ? 0.55 : 1 }}>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={i.label}>{i.label}</Typography>
            <Typography variant="body2" fontWeight={600}>{nf.format(i.value)}</Typography>
            {showShare && (
              <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: 'right' }}>
                {Math.round((i.value / total) * 100)}%
              </Typography>
            )}
          </Stack>
          <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${max ? (i.value / max) * 100 : 0}%`, bgcolor: color, borderRadius: 3, transition: 'width 200ms' }} />
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

// Twenty-four columns, one per hour of the UTC day, each one selectable.
//
// A column is a real button: the hour is chosen with a click, the keyboard or a
// screen reader alike, and the selected one stays visibly selected rather than
// relying on colour alone. Hours with no traffic still draw — a flat column at
// the baseline says "nobody came" where a gap would say nothing at all.
export const HourBars = ({
  items, selected, onSelect, color = SERIES.blue, height = 132, formatHour, formatWindow
}) => {
  const max = Math.max(0, ...items.map((i) => i.visitors))

  return (
    <Box>
      <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height, mb: 0.5 }}>
        {items.map((i) => {
          const isSelected = String(selected) === String(i.hour)
          const ratio = max ? i.visitors / max : 0
          return (
            <Box
              key={i.hour}
              component="button"
              type="button"
              onClick={() => onSelect(isSelected ? '' : String(i.hour))}
              aria-pressed={isSelected}
              aria-label={`${formatHour(i.hour)}, ${formatWindow(i.hour)}: ${nf.format(i.visitors)} visitors`}
              title={`${formatHour(i.hour)} · ${formatWindow(i.hour)} · ${nf.format(i.visitors)} visitors`}
              sx={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                p: 0,
                border: 0,
                bgcolor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                borderRadius: 1,
                '&:hover > *': { opacity: 0.85 },
                '&:focus-visible': { outline: '2px solid', outlineColor: color, outlineOffset: 2 }
              }}
            >
              <Box
                sx={{
                  // A hair of height even at nought, so every hour is a target.
                  height: `${Math.max(ratio * 100, i.visitors ? 4 : 2)}%`,
                  bgcolor: isSelected ? color : `${color}59`,
                  border: isSelected ? 0 : 1,
                  borderColor: `${color}80`,
                  borderRadius: 1,
                  transition: 'height 200ms, background-color 150ms'
                }}
              />
            </Box>
          )
        })}
      </Stack>

      <Stack direction="row" spacing={0.5}>
        {items.map((i) => {
          const isSelected = String(selected) === String(i.hour)
          return (
            <Typography
              key={i.hour}
              variant="caption"
              align="center"
              sx={{
                flex: 1,
                minWidth: 0,
                fontSize: 10,
                fontVariantNumeric: 'tabular-nums',
                color: isSelected ? 'text.primary' : 'text.disabled',
                fontWeight: isSelected ? 700 : 400
              }}
            >
              {String(i.hour).padStart(2, '0')}
            </Typography>
          )
        })}
      </Stack>
    </Box>
  )
}
