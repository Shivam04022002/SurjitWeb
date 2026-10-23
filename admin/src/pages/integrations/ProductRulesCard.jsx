import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Box, Paper, Stack, Typography, Button, Chip, Alert, Autocomplete, TextField, CircularProgress,
  createFilterOptions
} from '@mui/material'
import { Save, Close, Category, Refresh } from '@mui/icons-material'
import { productsService } from '../../services/products.service'
import { usePagePermission } from '../../hooks/usePermissions'
import { emailSettingsService } from '../../services/emailSettings.service'
import {
  productIdsFromConfig, productRulesDirty, productOptions, productName, productOptionLabel,
  productSearchText, productRulesSummary, productCatalogueError, serverFieldErrors, requestErrorMessage,
  PRODUCTS_ACCESS_NEEDED
} from './emailSettings'

const filterOptions = createFilterOptions({ stringify: productSearchText })

// Product Notification Rules: which products' new loan applications are
// emailed. Saved on its own, so it never sends the recipients form's unsaved
// edits, and saving it never sends or queues an email.
const ProductRulesCard = ({ config, readOnly, onSaved }) => {
  const baseline = useMemo(() => productIdsFromConfig(config), [config])
  // null: unchanged from what the server last reported.
  const [edited, setEdited] = useState(null)
  const selectedIds = edited ?? baseline
  const dirty = edited !== null && productRulesDirty(edited, baseline)

  // The product list is the Products page's own API, so it needs Products
  // view. Without it the list is not requested at all: a refused request would
  // make the CMS re-read this session's permissions and reload the page.
  const products = usePagePermission('products')
  const catalogueBlocked = !products.loading && !products.canView
  const [catalogue, setCatalogue] = useState([])
  const [catalogueRequestPending, setCatalogueLoading] = useState(true)
  const [catalogueRequestError, setCatalogueError] = useState('')
  const catalogueLoading = !catalogueBlocked && catalogueRequestPending
  const catalogueError = catalogueBlocked ? PRODUCTS_ACCESS_NEEDED : catalogueRequestError
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [fieldError, setFieldError] = useState('')

  // The same product list the Loan Applications filter uses. State is set only
  // once the request settles.
  const loadCatalogue = useCallback(() => productsService.getAllProducts()
    .then((res) => {
      setCatalogue(res?.data?.products || [])
      setCatalogueError('')
    })
    .catch((err) => setCatalogueError(productCatalogueError(err)))
    .finally(() => setCatalogueLoading(false)), [])

  useEffect(() => {
    if (products.loading || !products.canView) return
    loadCatalogue()
  }, [loadCatalogue, products.loading, products.canView])

  const retryCatalogue = () => {
    setCatalogueLoading(true)
    loadCatalogue()
  }

  const options = useMemo(() => productOptions(catalogue, config), [catalogue, config])
  const byId = useMemo(() => new Map(options.map((o) => [o._id, o])), [options])
  const value = selectedIds.map((id) => byId.get(id) || { _id: id, name: '', exists: false })

  const handleChange = (_, next) => {
    setEdited(next.map((o) => o._id))
    setFieldError('')
    setNotice(null)
  }

  const handleSave = async () => {
    if (readOnly || saving || !dirty) return
    setSaving(true)
    setNotice(null)
    try {
      const res = await emailSettingsService.saveProductRules(selectedIds)
      onSaved(res.data.config)
      setEdited(null)
      setFieldError('')
      setNotice({ severity: 'success', message: selectedIds.length ? 'Product notification rules saved.' : 'Product filter removed: every new loan application sends the email.' })
    } catch (err) {
      setFieldError(serverFieldErrors(err).productIds || '')
      setNotice({ severity: 'error', message: `Not saved: ${requestErrorMessage(err, 'the server could not save the product rules.')}` })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEdited(null)
    setFieldError('')
    setNotice(null)
  }

  const helper = fieldError
    || (catalogueLoading ? 'Loading products…' : 'Search by product name, category or ID. Leave empty to email about every product.')

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }} component="section" aria-labelledby="email-product-rules-title">
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Category color="action" />
        <Typography variant="subtitle1" fontWeight={600} component="h2" id="email-product-rules-title">Product Notification Rules</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the loan products whose new applications are emailed to the recipients above.
      </Typography>

      <Stack spacing={2}>
        <Alert severity={selectedIds.length ? 'info' : 'success'} variant="outlined" aria-live="polite">
          {productRulesSummary(selectedIds)}
        </Alert>

        {catalogueError && (
          <Alert
            severity="warning"
            action={catalogueBlocked ? null : <Button color="inherit" size="small" startIcon={<Refresh />} onClick={retryCatalogue} disabled={catalogueLoading}>Retry</Button>}
          >
            {catalogueError}
          </Alert>
        )}

        <Autocomplete
          multiple
          id="email-productIds"
          options={options}
          value={value}
          onChange={handleChange}
          filterOptions={filterOptions}
          filterSelectedOptions
          disableCloseOnSelect
          loading={catalogueLoading}
          disabled={readOnly || saving}
          getOptionLabel={productOptionLabel}
          isOptionEqualToValue={(o, v) => o._id === v._id}
          // Products missing from the catalogue can be removed, not added.
          getOptionDisabled={(o) => o.exists === false}
          noOptionsText={catalogueError ? 'The product list could not be loaded' : 'No matching products'}
          renderOption={(props, option) => {
            const { key, ...rest } = props
            return (
              <Box component="li" key={key} {...rest}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">
                    {productName(option)}
                    {option.exists !== false && !option.isActive && <Chip component="span" size="small" label="Inactive" sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                    {option.category ? `${option.category} · ` : ''}{option._id}
                  </Typography>
                </Box>
              </Box>
            )
          }}
          renderTags={(selected, getTagProps) => selected.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index })
            return (
              <Chip
                key={key}
                {...tagProps}
                size="small"
                color={option.exists === false ? 'error' : 'default'}
                label={(
                  <span>
                    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{productName(option)}</Box>
                    {/* The id sits under the name on phones, beside it from small tablets up. */}
                    <Box component="span" sx={{ display: { xs: 'block', sm: 'inline' }, ml: { xs: 0, sm: 0.75 }, fontFamily: 'monospace', fontSize: '0.75em', opacity: 0.75 }}>{option._id}</Box>
                    {option.exists !== false && !option.isActive ? ' (inactive)' : ''}
                  </span>
                )}
                aria-label={`${productName(option)}, ${option._id}`}
                sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.25 } }}
              />
            )
          })}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Products"
              placeholder={selectedIds.length ? '' : 'All products (no filter)'}
              error={!!fieldError}
              helperText={helper}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {catalogueLoading ? <CircularProgress color="inherit" size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
        />

        {notice && <Alert severity={notice.severity} role="alert">{notice.message}</Alert>}

        {!readOnly && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? 'Saving…' : 'Save product rules'}
            </Button>
            <Button variant="outlined" startIcon={<Close />} onClick={handleCancel} disabled={saving || !dirty}>
              Cancel
            </Button>
            {dirty && <Typography variant="body2" color="text.secondary">Unsaved changes</Typography>}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

export default ProductRulesCard
