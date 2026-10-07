/** Number formatting for analysis results. */

const MISSING = '—'

export function formatNumber(value, digits = 4) {
  if (value == null || Number.isNaN(value)) return MISSING
  if (Number.isInteger(value)) return value.toLocaleString()
  const abs = Math.abs(value)
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return value.toExponential(2)
  return Number(value.toPrecision(digits)).toLocaleString(undefined, { maximumFractionDigits: 6 })
}

export function formatPValue(value) {
  if (value == null || Number.isNaN(value)) return MISSING
  if (value < 0.001) return '< 0.001'
  return value.toFixed(3)
}

export const formatInterval = (lower, upper) =>
  lower == null && upper == null ? MISSING : `${formatNumber(lower)} – ${formatNumber(upper)}`

export const isSignificant = (pValue, alpha) => pValue != null && alpha != null && pValue < alpha

export const formatDateTime = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '')