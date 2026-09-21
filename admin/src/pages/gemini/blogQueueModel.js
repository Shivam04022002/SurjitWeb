// The generation list shared by Single Blog and Bulk Upload: pure functions
// over plain row objects, so the rules can be tested without a browser.
//
// A row moves through:
//
//   pending ─┬─> queued -> generating -> generated -> saving -> saved
//   invalid ─┘                  │                        │
//                               └─> gen_failed           └─> save_failed
//
// `pending` and `invalid` are the plan stage: the row is only a date, topic,
// category and image choice, validated by the server's plan rules. From
// `generated` on, the row carries an editable blog (`form`).

import { newKey } from './geminiBlogUtils.js'

export const PLAN_STAGE = ['pending', 'invalid']
export const HAS_CONTENT = ['generated', 'saving', 'saved', 'save_failed']
export const BUSY = ['queued', 'generating', 'saving']

export const STATUS = {
  pending: { label: 'Pending', color: 'default' },
  invalid: { label: 'Invalid', color: 'error', variant: 'outlined' },
  queued: { label: 'Queued', color: 'default', variant: 'outlined' },
  generating: { label: 'Generating', color: 'info' },
  generated: { label: 'Generated', color: 'success', variant: 'outlined' },
  gen_failed: { label: 'Failed', color: 'error' },
  saving: { label: 'Saving', color: 'info' },
  saved: { label: 'Draft saved', color: 'success' },
  save_failed: { label: 'Save failed', color: 'error' }
}

// A plan row. `input` is what the admin typed or the spreadsheet held —
// kept as entered so an invalid value can be shown exactly and re-checked;
// the normalised date/category/image come from server validation.
export const newRow = ({
  source = 'manual', sourceRow = null, input, date = null, topic = '', category = null,
  generateImage = true, imageDefaulted = false, errors = [], warnings = []
}) => ({
  id: newKey('row'),
  source,
  sourceRow,
  input: { date: '', topic: '', category: '', generateImage: true, ...input },
  date,
  topic,
  category,
  generateImage,
  imageDefaulted,
  errors,
  warnings,
  status: errors.length ? 'invalid' : 'pending',
  error: '',
  form: null,
  formVersion: 0,
  imagePrompt: '',
  genWarnings: [],
  image: { status: 'idle', preview: '', error: '', key: 0 },
  file: null,
  saveKey: null,
  savedBlog: null
})

// A row from the server's validation result (upload or re-validation).
export const fromValidated = (v, source) => newRow({
  source,
  sourceRow: v.sourceRow,
  input: { ...v.input, category: v.category ? v.category._id : v.input.category, generateImage: v.input.generateImage },
  date: v.date,
  topic: v.topic,
  category: v.category,
  generateImage: v.generateImage ?? true,
  imageDefaulted: v.imageDefaulted,
  errors: v.errors,
  warnings: v.warnings
})

// What the validate endpoint needs for every row in the list. Generated rows
// are included so a new topic or date cannot repeat one already generated.
export const planInputs = (rows) => rows.map((r) => ({
  date: r.form ? r.date || '' : String(r.input.date ?? ''),
  topic: r.form ? r.topic : String(r.input.topic ?? ''),
  category: r.form ? (r.category?._id || '') : String(r.input.category ?? ''),
  generateImage: typeof r.input.generateImage === 'boolean' ? r.input.generateImage : String(r.input.generateImage ?? ''),
  ...(r.sourceRow ? { sourceRow: r.sourceRow } : {})
}))

// Applies a validation result (in the same order as `ids`) to plan-stage
// rows only; a row that has moved on since the request is left alone.
export const applyValidation = (rows, ids, results) => {
  const byId = new Map(ids.map((id, i) => [id, results[i]]))
  return rows.map((r) => {
    const v = byId.get(r.id)
    if (!v || !PLAN_STAGE.includes(r.status)) return r
    return {
      ...r,
      date: v.date,
      topic: v.topic,
      category: v.category,
      generateImage: v.generateImage ?? r.generateImage,
      imageDefaulted: v.imageDefaulted,
      errors: v.errors,
      warnings: v.warnings,
      status: v.errors.length ? 'invalid' : 'pending'
    }
  })
}

// An edit from the row dialog: new plan values, back to the plan stage.
export const editPlan = (row, { date, topic, category, generateImage }) => ({
  ...row,
  input: { ...row.input, date, topic, category, generateImage },
  status: 'pending',
  error: '',
  errors: [],
  form: null,
  file: null,
  saveKey: null,
  image: { status: 'idle', preview: '', error: '', key: row.image.key + 1 }
})

// Per-status tallies (c.pending, c.generated, c.gen_failed, …) plus summary
// totals whose names do not collide with any status.
export const counts = (rows) => {
  const c = { total: rows.length, invalid: 0, valid: 0, imagesRequested: 0, withContent: 0, readyToSave: 0, withoutImage: 0 }
  for (const r of rows) {
    c[r.status] = (c[r.status] || 0) + 1
    if (r.status !== 'invalid') {
      c.valid++
      if (r.generateImage) c.imagesRequested++
    }
    if (HAS_CONTENT.includes(r.status)) c.withContent++
    if (r.status === 'generated' && r.image.status !== 'generating') c.readyToSave++
    if (r.form && r.status !== 'saved' && !r.file && r.image.status !== 'generating') c.withoutImage++
  }
  return c
}

export const ids = (rows, statuses) => rows.filter((r) => statuses.includes(r.status)).map((r) => r.id)

// Two rows with near-identical titles can arrive with the same slug; later
// ones get a suffix so a batch never fails on its own clash.
export const dedupeSlugs = (rows, targetIds) => {
  const used = new Set(rows.filter((r) => r.status === 'saved').map((r) => r.savedBlog?.slug).filter(Boolean))
  const renamed = {}
  for (const r of rows) {
    if (!targetIds.includes(r.id) || !r.form) continue
    let slug = r.form.slug
    for (let n = 2; used.has(slug); n++) slug = `${r.form.slug}-${n}`
    used.add(slug)
    if (slug !== r.form.slug) renamed[r.id] = slug
  }
  return rows.map((r) => (renamed[r.id] ? { ...r, form: { ...r.form, slug: renamed[r.id] } } : r))
}

// Discarding blogs that were generated but not saved needs a confirmation.
export const hasUnsaved = (rows) => rows.some((r) => r.form && r.status !== 'saved')
