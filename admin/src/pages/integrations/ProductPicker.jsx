import { Box, Typography, Chip, Autocomplete, TextField, CircularProgress, createFilterOptions } from '@mui/material'
import { productName, productOptionLabel, productSearchText } from './emailSettings'

const filterOptions = createFilterOptions({ stringify: productSearchText })

// A searchable choice of loan products, shown as chips with each product's
// name and id. Used for one additional recipient's product assignment.
// `value` is a list of product ids; `options` from productOptions().
const ProductPicker = ({ id, label, value, options, onChange, disabled, loading, unavailable, error, helperText }) => {
  const byId = new Map(options.map((o) => [o._id, o]))
  const selected = value.map((pid) => byId.get(pid) || { _id: pid, name: '', exists: false })

  return (
    <Autocomplete
      multiple
      id={id}
      size="small"
      options={options}
      value={selected}
      onChange={(_, next) => onChange(next.map((o) => o._id))}
      filterOptions={filterOptions}
      filterSelectedOptions
      disableCloseOnSelect
      loading={loading}
      disabled={disabled}
      getOptionLabel={productOptionLabel}
      isOptionEqualToValue={(o, v) => o._id === v._id}
      // Products missing from the catalogue can be removed, not added.
      getOptionDisabled={(o) => o.exists === false}
      noOptionsText={unavailable ? 'The product list is not available' : 'No matching products'}
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
      renderTags={(chosen, getTagProps) => chosen.map((option, index) => {
        const { key, ...tagProps } = getTagProps({ index })
        return (
          <Chip
            key={key}
            {...tagProps}
            size="small"
            color={option.exists === false ? 'error' : 'default'}
            label={(
              <span>
                <Box component="span">{productName(option)}</Box>
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
          label={label}
          placeholder={value.length ? '' : 'Search products by name, category or ID'}
          error={!!error}
          helperText={error || helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  )
}

export default ProductPicker
