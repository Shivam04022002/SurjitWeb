// The saved monthly plan, as the page reads it.
//
// A plan row is scheduled work, not a preview: it waits for its day, the server
// generates it, and what comes back is a draft to review. These are the pure
// parts of saying that — what each state is called, what the counts mean, and
// what the browser sends when it saves a plan — so the rules can be tested
// without a browser.
//
// The plan lives in the database. Nothing here keeps a copy: every state on
// screen came from the last read of the server, which is the only source of
// truth for what is scheduled.

// A row's life. `invalid` never starts it; `missed` is where a row ends up if
// its day went by without the scheduler reaching it.
export const PLAN_ROW_STATUS = {
  invalid: { label: 'Invalid', color: 'error', variant: 'outlined' },
  scheduled: { label: 'Scheduled', color: 'info', variant: 'outlined' },
  generating: { label: 'Generating', color: 'info' },
  generated: { label: 'Generated → Draft', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  missed: { label: 'Missed', color: 'warning', variant: 'outlined' }
}

export const PLAN_ROW_STATUSES = Object.keys(PLAN_ROW_STATUS)

// A row the admin can ask to run again: it did not produce a draft, and it is
// not simply waiting for its day.
export const canRetry = (row) => !!row && ['failed', 'missed'].includes(row.status)

// A row that produced a draft can be opened. Nothing else can.
export const draftOf = (row) => (row && row.status === 'generated' && row.blog ? row.blog : null)

// What the rows of a validated plan look like on the wire when saved. The
// server re-validates them, so this only has to carry what the admin gave.
export const planPayload = (rows = []) => rows.map((r) => ({
  date: r.input?.date ?? r.date ?? '',
  topic: r.input?.topic ?? r.topic ?? '',
  category: r.input?.category ?? (r.category?.name || ''),
  generateImage: r.input?.generateImage ?? (r.generateImage ? 'Yes' : 'No'),
  sourceRow: r.sourceRow ?? null
}))

// The counts the page shows above the table. Taken from the server's own
// summary where there is one, so the page and the scheduler never disagree
// about how much is outstanding.
export const planCounts = (summary = {}) => ({
  total: summary.total || 0,
  invalid: summary.invalid || 0,
  scheduled: (summary.scheduled || 0) + (summary.generating || 0),
  generated: summary.generated || 0,
  failed: (summary.failed || 0) + (summary.missed || 0)
})

// The line under the plan's name: what it is waiting on, in words.
export const planSummaryLine = (summary = {}) => {
  const c = planCounts(summary)
  if (!c.total) return 'No plan saved'
  const parts = [`${c.total} ${c.total === 1 ? 'row' : 'rows'}`]
  if (c.scheduled) parts.push(`${c.scheduled} scheduled`)
  if (c.generated) parts.push(`${c.generated} generated`)
  if (c.failed) parts.push(`${c.failed} needing attention`)
  if (c.invalid) parts.push(`${c.invalid} invalid`)
  return parts.join(' · ')
}

// Whether a row's day has arrived, both read as calendar days in the same
// timezone the server schedules in. Compared as strings on purpose: these are
// days, not instants, and parsing them into Dates is what would let a browser
// in another timezone disagree about which day it is.
export const isDue = (row, today) => !!row && !!today && row.scheduledDay <= today

// What the row says about when it will run.
export const whenLine = (row, today) => {
  if (!row) return ''
  if (row.status === 'generated') return 'Generated'
  if (row.status === 'invalid') return 'Not scheduled'
  if (row.status === 'missed') return 'Its day passed'
  if (row.scheduledDay === today) return 'Due today'
  return row.scheduledDay > today ? 'Waiting for its day' : 'Overdue'
}
