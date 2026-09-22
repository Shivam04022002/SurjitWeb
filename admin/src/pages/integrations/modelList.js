// The "Free fallback models" field: model names separated by commas or line
// breaks. Only whitespace and empty entries are removed here; everything
// else (text models only, no duplicates, not the primary model) is checked by
// the server, so what is typed is exactly what is sent.
export const parseModelList = (text) => String(text || '')
  .split(/[,\n]/)
  .map((m) => m.trim())
  .filter(Boolean)

export const formatModelList = (models) => (Array.isArray(models) ? models.join(', ') : '')
