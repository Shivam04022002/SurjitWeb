import { useState } from 'react'
import {
  Box, Typography, TextField, Button, Grid, Paper, Stack, MenuItem, Alert,
  CircularProgress, Chip, Divider, FormHelperText
} from '@mui/material'
import { ImageOutlined } from '@mui/icons-material'
import { Link } from '@mui/material'
import RichTextEditor from '../../components/RichTextEditor'
import ImageUpload from '../../components/ImageUpload'
import { SITE_URL, slugify, formatDay } from './geminiBlogUtils'

// The editable preview of a generated blog, shared by the Single Blog and
// Bulk Upload flows. Every field is editable; nothing here saves — the
// parent decides when to send the draft.
//
// `image` describes the featured image: { status, preview, error, key } where
// status is idle | generating | ready | failed | skipped | off | uploaded. A generated image and an
// uploaded one are handled the same way: the parent keeps the File and sends
// it with the draft, so it reaches the media store only on a successful save.
const GeneratedBlogEditor = ({
  form,
  onFormChange,
  errors = {},
  onClearError,
  categories,
  createDate,
  onCreateDateChange,
  dateMin,
  dateMax,
  image,
  hasImageFile,
  imageEnabled,
  onImageFile,
  onGenerateImage,
  imageCredit = null,
  disabled = false,
  showToast
}) => {
  // The slug follows the title until the admin edits it by hand.
  const [slugTouched, setSlugTouched] = useState(false)

  const setField = (name, value) => {
    onFormChange((f) => ({ ...f, [name]: value }))
    onClearError?.(name)
  }
  const setSeo = (name, value) => onFormChange((f) => ({ ...f, seo: { ...f.seo, [name]: value } }))
  const handleTitle = (value) => {
    onFormChange((f) => ({ ...f, title: value, ...(slugTouched ? {} : { slug: slugify(value) }) }))
    onClearError?.('title')
  }

  return (
    <Box sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', transition: 'opacity 150ms' }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Stack spacing={2.5}>
              <TextField
                label="Blog Title" required fullWidth value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                error={!!errors.title} helperText={errors.title}
                inputProps={{ maxLength: 250 }}
              />
              <TextField
                label="Slug" required fullWidth value={form.slug}
                onChange={(e) => { setSlugTouched(true); setField('slug', e.target.value) }}
                error={!!errors.slug}
                helperText={errors.slug || `Public URL once published: ${SITE_URL}/blogs/${form.slug || 'your-slug'}`}
                inputProps={{ maxLength: 300 }}
              />
              <TextField
                label="Short Description (Excerpt)" required fullWidth multiline rows={3}
                value={form.summary} onChange={(e) => setField('summary', e.target.value)}
                error={!!errors.summary}
                helperText={errors.summary || `${form.summary.length}/1000 — shown on the blog listing card`}
                inputProps={{ maxLength: 1000 }}
              />
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Full Content *</Typography>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setField('content', html)}
              showToast={showToast}
            />
            {errors.content && <FormHelperText error sx={{ mt: 1 }}>{errors.content}</FormHelperText>}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>SEO</Typography>
            <Stack spacing={2.5}>
              <TextField
                label="SEO Title" fullWidth value={form.seo.metaTitle}
                onChange={(e) => setSeo('metaTitle', e.target.value)}
                helperText={`${form.seo.metaTitle.length} characters — about 60 displays fully in search results`}
                inputProps={{ maxLength: 250 }}
              />
              <TextField
                label="SEO Meta Description" fullWidth multiline rows={2} value={form.seo.metaDescription}
                onChange={(e) => setSeo('metaDescription', e.target.value)}
                helperText={`${form.seo.metaDescription.length} characters — about 155 displays fully`}
                inputProps={{ maxLength: 500 }}
              />
              <TextField
                label="SEO Keywords" fullWidth value={form.seo.metaKeywords}
                onChange={(e) => setSeo('metaKeywords', e.target.value)}
                helperText="Comma separated"
                inputProps={{ maxLength: 500 }}
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Featured Image</Typography>
            {image.status === 'generating' && (
              <Stack alignItems="center" spacing={1} sx={{ py: 4, border: 1, borderColor: 'divider', borderRadius: 1, borderStyle: 'dashed' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">Generating image…</Typography>
              </Stack>
            )}
            {image.status !== 'generating' && (
              <ImageUpload
                key={image.key}
                label="Featured Image"
                name="featuredImage"
                currentImageUrl={image.preview}
                onChange={onImageFile}
              />
            )}
            {imageCredit?.source === 'pexels' && hasImageFile && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                Photo by{' '}
                <Link href={imageCredit.photoUrl} target="_blank" rel="noopener noreferrer">{imageCredit.photographer}</Link>
                {' '}on{' '}
                <Link href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</Link>
              </Typography>
            )}
            {image.status === 'ready' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                A free Pexels photo, saved to the media store only when you save the draft.
              </Typography>
            )}
            {image.status === 'failed' && (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                {image.error} You can retry, or upload your own image above.
              </Alert>
            )}
            {image.status === 'skipped' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                No image was requested for this blog. Upload one above, or find one.
              </Typography>
            )}
            {image.status === 'off' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Automatic images are unavailable (turned off, or no Pexels key). Upload a featured image above.
              </Typography>
            )}
            {imageEnabled && image.status !== 'generating' && onGenerateImage && (
              <Button
                size="small" sx={{ mt: 1.5 }} startIcon={<ImageOutlined />}
                onClick={onGenerateImage}
                disabled={disabled || !form.title.trim()}
              >
                {image.status === 'ready' ? 'Find Another Image' : 'Find Image'}
              </Button>
            )}
            {!hasImageFile && image.status !== 'generating' && (
              <FormHelperText sx={{ mt: 1 }}>
                A draft can be saved without an image, but one is needed before publishing.
              </FormHelperText>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Details</Typography>
            <Stack spacing={2.5}>
              <TextField
                label="Create Date" type="date" required fullWidth value={createDate}
                onChange={(e) => { onCreateDateChange(e.target.value); onClearError?.('createDate') }}
                error={!!errors.createDate}
                helperText={errors.createDate || (createDate ? `Saved as ${formatDay(createDate)}` : '')}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: dateMin, max: dateMax }}
              />
              <TextField
                select label="Category" fullWidth value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                error={!!errors.category}
                helperText={errors.category || 'From your existing categories'}
              >
                <MenuItem value="">Uncategorised</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c._id} value={c._id} disabled={!c.isActive}>
                    {c.name}{!c.isActive ? ' (disabled)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Tags" fullWidth value={form.tags}
                onChange={(e) => setField('tags', e.target.value)}
                helperText="Comma separated"
              />
              <TextField
                label="Author" fullWidth value={form.author}
                onChange={(e) => setField('author', e.target.value)}
                inputProps={{ maxLength: 120 }}
              />
              <Divider />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Status after saving:</Typography>
                <Chip label="Draft" size="small" />
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default GeneratedBlogEditor
