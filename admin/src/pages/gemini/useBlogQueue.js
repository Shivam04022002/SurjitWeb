import { useState, useRef, useCallback, useEffect } from 'react'
import { geminiService } from '../../services/gemini.service'
import {
  errorMessage, base64ToFile, formFromGenerated, validateBlogForm, buildDraftFormData, newKey, splitList
} from './geminiBlogUtils'
import { PLAN_STAGE, planInputs, applyValidation, dedupeSlugs, hasUnsaved, editPlan } from './blogQueueModel'

// Runs a generation list: validates plan rows on the server, generates rows
// through the existing Gemini endpoints two at a time, and saves them as
// drafts through the existing draft endpoint with an idempotency key.
//
// Rows fail independently. A failed row keeps its error; retrying touches
// only failed rows, and a successful row is never regenerated or re-saved
// unless the admin asks for that row.
export const useBlogQueue = ({ availability, showToast }) => {
  const lanes = Math.max(1, Math.min(2, availability?.limits?.maxParallel || 2))
  const imagesOn = !!availability?.imageGenerationEnabled

  // Rows live in a ref as well as state: the queues read and update them
  // between renders and must always see the latest values.
  const rowsRef = useRef([])
  const [rows, setRows] = useState([])
  const update = useCallback((fn) => {
    rowsRef.current = fn(rowsRef.current)
    setRows(rowsRef.current)
  }, [])
  const patch = useCallback((id, p) => update((list) => list.map((r) => (
    r.id === id ? { ...r, ...(typeof p === 'function' ? p(r) : p) } : r
  ))), [update])
  const find = (id) => rowsRef.current.find((r) => r.id === id)

  // { kind: 'generate' | 'save', done, total } while a queue runs.
  const [run, setRun] = useState(null)
  const [pauseReason, setPauseReason] = useState('')
  const stopRef = useRef(false)
  const runningRef = useRef(false)
  const [validating, setValidating] = useState(false)
  const validationSeq = useRef(0)

  // Leaving the page would discard generated-but-unsaved blogs.
  useEffect(() => {
    if (!run && !hasUnsaved(rows)) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [rows, run])

  // ── Validation ──────────────────────────────────────────────────────────────

  // Re-checks every plan row against the server's rules (dates, categories,
  // duplicates across the whole list). Only the latest request's answer is
  // applied, so fast edits cannot be overwritten by a slower, older reply.
  const revalidate = useCallback(async () => {
    const list = rowsRef.current
    if (!list.some((r) => PLAN_STAGE.includes(r.status))) return true
    const seq = ++validationSeq.current
    setValidating(true)
    try {
      const res = await geminiService.validateBulkRows(planInputs(list))
      if (seq !== validationSeq.current) return true
      update((current) => applyValidation(current, list.map((r) => r.id), res.data.rows))
      return true
    } catch (err) {
      showToast(errorMessage(err, 'Could not validate the list.'), 'error')
      return false
    } finally {
      if (seq === validationSeq.current) setValidating(false)
    }
  }, [update, showToast])

  const addRows = useCallback(async (newRows, { atStart = false } = {}) => {
    update((list) => (atStart ? [...newRows, ...list] : [...list, ...newRows]))
    await revalidate()
    return newRows.map((r) => find(r.id))
  }, [update, revalidate])

  const replaceRows = useCallback((newRows) => update(() => newRows), [update])

  const removeRows = useCallback(async (removeIds) => {
    update((list) => list.filter((r) => !removeIds.includes(r.id)))
    await revalidate()
  }, [update, revalidate])

  const editRow = useCallback(async (id, values) => {
    patch(id, (r) => editPlan(r, values))
    await revalidate()
  }, [patch, revalidate])

  // ── Queue ───────────────────────────────────────────────────────────────────
  // At most `lanes` rows are in flight; each lane takes the next row when it
  // finishes one. Stopping (by the admin, or on a rate limit) lets rows that
  // already started finish and returns the rest to where they were.

  const runQueue = async (kind, targetIds, worker, restore) => {
    runningRef.current = true
    stopRef.current = false
    setPauseReason('')
    setRun({ kind, done: 0, total: targetIds.length })
    let next = 0
    const lane = async () => {
      while (next < targetIds.length && !stopRef.current) {
        const id = targetIds[next++]
        await worker(id)
        setRun((r) => (r ? { ...r, done: r.done + 1 } : r))
      }
    }
    await Promise.all(Array.from({ length: Math.min(lanes, targetIds.length) }, lane))
    update((list) => list.map((r) => (r.status === 'queued' ? { ...r, status: restore(r) } : r)))
    setRun(null)
    runningRef.current = false
  }

  const onRateLimit = (err) => {
    if (err?.response?.status === 429) {
      stopRef.current = true
      setPauseReason(errorMessage(err, 'Gemini request limit reached.'))
    }
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  const generateImage = useCallback(async (id) => {
    const row = find(id)
    if (!row?.form || row.image.status === 'generating') return
    patch(id, (r) => ({ image: { ...r.image, status: 'generating', error: '' } }))
    try {
      // The article itself goes along, so the image is made for this blog.
      const res = await geminiService.generateImage({
        title: row.form.title,
        summary: row.form.summary,
        topic: row.topic,
        content: row.form.content,
        category: row.category?.name,
        tags: splitList(row.form.tags).slice(0, 20),
        imagePrompt: row.imagePrompt,
        // Each attempt asks for a different composition ("find another").
        variation: row.imageAttempts,
        // Pexels photos already offered for this blog are skipped.
        excludePhotoIds: row.offeredPhotoIds,
        rowKey: row.id
      })
      const { data, mimeType, credit, provider, model, modelName, branded, notice } = res.data.image
      patch(id, (r) => ({
        file: base64ToFile(data, mimeType),
        imageCredit: provider === 'pexels' ? credit || null : null,
        imageMeta: { provider, model, modelName, branded },
        imageNotice: notice || '',
        imageAttempts: r.imageAttempts + 1,
        offeredPhotoIds: credit?.photoId ? [...new Set([...r.offeredPhotoIds, credit.photoId])] : r.offeredPhotoIds,
        image: { status: 'ready', preview: `data:${mimeType};base64,${data}`, error: '', key: r.image.key + 1 }
      }))
    } catch (err) {
      // Non-fatal: the blog stays generated and the admin can upload an image.
      // An image-provider limit does not pause text generation for other rows.
      patch(id, (r) => ({
        imageAttempts: r.imageAttempts + 1,
        image: { ...r.image, status: 'failed', error: errorMessage(err, 'No featured image could be created.') }
      }))
    }
  }, [patch])

  const generateRow = async (id) => {
    const row = find(id)
    if (!row) return
    const hadContent = !!row.form
    patch(id, { status: 'generating', error: '' })
    try {
      const res = await geminiService.generateBlog({
        topic: row.topic,
        createDate: row.date,
        category: row.category?._id || undefined,
        rowKey: row.id
      })
      const result = res.data
      const wantImage = row.generateImage && result.imageGenerationEnabled
      patch(id, (r) => ({
        status: 'generated',
        form: formFromGenerated(result.blog),
        formVersion: r.formVersion + 1,
        category: result.blog.category || r.category,
        imagePrompt: result.imagePrompt || '',
        genWarnings: result.warnings || [],
        // A new version of the blog is a new save request.
        saveKey: newKey('save'),
        file: null,
        imageCredit: null,
        imageMeta: null,
        imageNotice: '',
        imageAttempts: 0,
        image: {
          status: wantImage ? 'idle' : row.generateImage ? 'off' : 'skipped',
          preview: '', error: '', key: r.image.key + 1
        }
      }))
      if (wantImage) {
        if (stopRef.current) {
          patch(id, (r) => ({ image: { ...r.image, status: 'failed', error: 'Stopped before the image was generated.' } }))
        } else {
          await generateImage(id)
        }
      }
    } catch (err) {
      // A failed regenerate keeps the previous version rather than losing it.
      patch(id, hadContent
        ? { status: 'generated', error: `Regeneration failed: ${errorMessage(err, 'unknown error')} The previous version is kept.` }
        : { status: 'gen_failed', error: errorMessage(err, 'Generation failed.') })
      onRateLimit(err)
    }
  }

  // Generates the given rows (default: all pending). Returns when done.
  const generate = async (targetIds) => {
    if (runningRef.current) return
    const valid = targetIds.filter((id) => {
      const r = find(id)
      return r && r.status !== 'invalid' && r.date && r.topic
    })
    if (!valid.length) return
    update((list) => list.map((r) => (valid.includes(r.id) ? { ...r, status: 'queued', error: '' } : r)))
    await runQueue('generate', valid, generateRow, (r) => (r.form ? 'generated' : r.error ? 'gen_failed' : 'pending'))
    const failed = valid.filter((id) => find(id)?.status === 'gen_failed').length
    const ok = valid.length - failed
    if (valid.length > 1 || failed) {
      showToast(failed ? `${ok} generated, ${failed} failed` : `${ok} blog${ok === 1 ? '' : 's'} generated`, failed ? 'warning' : 'success')
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveRow = async (id) => {
    const row = find(id)
    if (!row?.form) return
    const errs = validateBlogForm(row.form, row.date)
    if (Object.keys(errs).length) {
      patch(id, { status: 'save_failed', error: `Fix before saving: ${Object.values(errs).join('; ')}` })
      return
    }
    patch(id, { status: 'saving', error: '' })
    try {
      const res = await geminiService.saveDraft(buildDraftFormData(row.form, row.date, row.file, {
        idempotencyKey: row.saveKey,
        imageCredit: row.imageCredit,
        imageMeta: row.imageMeta
      }))
      patch(id, { status: 'saved', savedBlog: res.data.blog, error: '' })
    } catch (err) {
      const fields = (err?.response?.data?.errors || []).map((e) => e.message)
      patch(id, { status: 'save_failed', error: [errorMessage(err, 'Save failed.'), ...fields].join(' — ') })
    }
  }

  const save = async (targetIds) => {
    if (runningRef.current) return 0
    const eligible = targetIds.filter((id) => {
      const r = find(id)
      return r?.form && ['generated', 'save_failed'].includes(r.status) && r.image.status !== 'generating'
    })
    if (!eligible.length) return 0
    update((list) => dedupeSlugs(list, eligible).map((r) => (eligible.includes(r.id) ? { ...r, status: 'queued', error: '' } : r)))
    await runQueue('save', eligible, saveRow, () => 'generated')
    const saved = eligible.filter((id) => find(id)?.status === 'saved').length
    if (eligible.length > 1) {
      showToast(saved === eligible.length ? `${saved} drafts saved` : `${saved} of ${eligible.length} drafts saved`,
        saved === eligible.length ? 'success' : 'warning')
    } else if (saved) {
      showToast('Draft saved')
    }
    return saved
  }

  const stop = useCallback(() => { stopRef.current = true }, [])

  return {
    rows, rowsRef, update, patch, run, pauseReason, setPauseReason, validating, imagesOn,
    revalidate, addRows, replaceRows, removeRows, editRow, generate, generateImage, save, stop
  }
}

export default useBlogQueue
