// Helpers shared by the Single Blog and Monthly Blogs panels.

export const SITE_URL = 'https://surjitfinance.com'
export const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Today in India, the timezone the server stores create dates in.
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

export const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 300)

export const formatDay = (day, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  if (!day) return ''
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts)
}

export const errorMessage = (err, fallback) => err?.response?.data?.message || fallback

export const splitList = (value) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean)

// A random id the server accepts as a row or idempotency key.
export const newKey = (prefix) => {
  const rand = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}_${rand}`.slice(0, 64)
}

// The generated image arrives as base64; the draft endpoint takes it as a
// normal file upload, exactly as if the admin had picked it.
export const base64ToFile = (data, mimeType) => {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  return new File([bytes], `gemini-featured.${ext}`, { type: mimeType })
}

export const formFromGenerated = (blog) => ({
  title: blog.title || '',
  slug: blog.slug || '',
  summary: blog.summary || '',
  content: blog.content || '',
  author: blog.author || 'Surjit Finance',
  category: blog.category?._id || '',
  tags: (blog.tags || []).join(', '),
  seo: {
    metaTitle: blog.seo?.metaTitle || '',
    metaDescription: blog.seo?.metaDescription || '',
    metaKeywords: blog.seo?.metaKeywords || ''
  }
})

// The same checks the server applies, so problems show before a request.
export const validateBlogForm = (form, createDate) => {
  const e = {}
  if (!form.title.trim()) e.title = 'Title is required'
  if (!form.slug.trim()) e.slug = 'Slug is required'
  else if (!SLUG_RX.test(form.slug)) e.slug = 'Lowercase letters, numbers and hyphens only'
  if (!form.summary.trim()) e.summary = 'Short description is required'
  if (!form.content.replace(/<[^>]*>/g, '').trim()) e.content = 'Content is required'
  if (!createDate) e.createDate = 'Create date is required'
  return e
}

// Same fields as the normal blog editor sends, plus the create date and, for
// monthly rows, the month and an idempotency key.
export const buildDraftFormData = (form, createDate, featuredFile, extras = {}) => {
  const fd = new FormData()
  fd.append('title', form.title)
  fd.append('slug', form.slug)
  fd.append('summary', form.summary)
  fd.append('content', form.content)
  fd.append('author', form.author)
  fd.append('category', form.category || '')
  fd.append('tags', form.tags)
  fd.append('seo.metaTitle', form.seo.metaTitle)
  fd.append('seo.metaDescription', form.seo.metaDescription)
  fd.append('seo.metaKeywords', form.seo.metaKeywords)
  fd.append('createDate', createDate)
  if (extras.planMonth) fd.append('planMonth', extras.planMonth)
  if (extras.idempotencyKey) fd.append('idempotencyKey', extras.idempotencyKey)
  if (featuredFile) fd.append('featuredImage', featuredFile)
  return fd
}
