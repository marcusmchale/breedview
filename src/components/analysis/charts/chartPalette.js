/**
 * Colours for analysis charts.
 *
 * Categorical slots are assigned in this fixed order, never cycled or regenerated.
 * The order was validated for colour-vision deficiency against the white panel surface:
 * all eight pass for adjacent marks; only the first three pass when every pair can
 * meet (e.g. scatter plots), so scatters add marker shapes beyond that.
 * Slots 3–5 are below 3:1 contrast on white, so charts always ship with a table.
 */
import { interpolateLab } from 'd3'

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

/** Colour of a categorical slot; slots past the palette fall back to grey with a shape to tell them apart. */
export const seriesColor = (index) => SERIES[index] ?? OTHER

export const OTHER = '#898781'

/** Marker shapes, used with colour so identity never depends on colour alone. */
export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross']

export const shapeFor = (index) => SHAPES[index % SHAPES.length]

/** SVG path of a marker of the given shape and size, centred on (0, 0). */
export function markerPath(shape, size = 8) {
  const r = size / 2
  switch (shape) {
    case 'square':
      return `M${-r},${-r}h${size}v${size}h${-size}Z`
    case 'triangle':
      return `M0,${-r * 1.15}L${r * 1.15},${r * 0.85}L${-r * 1.15},${r * 0.85}Z`
    case 'diamond':
      return `M0,${-r * 1.3}L${r * 1.3},0L0,${r * 1.3}L${-r * 1.3},0Z`
    case 'cross': {
      const t = r / 2.5
      return `M${-t},${-r}h${2 * t}v${r - t}h${r - t}v${2 * t}h${t - r}v${r - t}h${-2 * t}v${t - r}h${t - r}v${-2 * t}h${r - t}Z`
    }
    default:
      return `M${r},0A${r},${r} 0 1 1 ${-r},0A${r},${r} 0 1 1 ${r},0Z`
  }
}

/** Chart chrome and ink. */
export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff'
}

/** Diverging scale for values in [-1, 1]: red (negative) through a neutral grey to blue (positive). */
const DIVERGING_NEGATIVE = '#e34948'
const DIVERGING_NEUTRAL = '#f0efec'
const DIVERGING_POSITIVE = '#2a78d6'

const toNeutralNegative = interpolateLab(DIVERGING_NEUTRAL, DIVERGING_NEGATIVE)
const toNeutralPositive = interpolateLab(DIVERGING_NEUTRAL, DIVERGING_POSITIVE)

export function divergingColor(value) {
  if (value == null || Number.isNaN(value)) return null
  const v = Math.max(-1, Math.min(1, value))
  return v < 0 ? toNeutralNegative(-v) : toNeutralPositive(v)
}

/** Ink that stays readable on a diverging cell. */
export const divergingInk = (value) => (Math.abs(value ?? 0) > 0.6 ? '#ffffff' : INK.primary)
