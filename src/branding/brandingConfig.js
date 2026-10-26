// A deployment's branding (README.md, Branding): branding/branding.json beside the app, read at start-up
// (loadBranding), gives the brand's colours (the --brand-* variables of src/assets/styles/global.css), logos for the
// header, links and a line of text for the footer, a favicon, a font and a stylesheet of its own. Without it the app
// keeps its own, "white-label" look. The files it names are served from the branding folder, as the app contacts no
// third party; its links may go anywhere. What it can't use is left out, with a problem saying why. Imports nothing
// from Vue or the app, so the unit tests can load it.

// branding.json's colours, and the variables they set
export const COLORS = {
  header: '--brand-header',
  headerText: '--brand-header-text',
  primary: '--brand-primary',
  primaryDark: '--brand-primary-dark',
  accent: '--brand-accent',
  accentDark: '--brand-accent-dark',
  accentDarker: '--brand-accent-darker',
  accentLight: '--brand-accent-light',
  link: '--brand-link',
  footer: '--brand-footer',
  footerText: '--brand-footer-text'
}
// shades worked out from a colour given, where the branding gives none of its own: [from, mixed with, % of from]
const DERIVED = {
  primaryDark: ['primary', 'black', 75],
  accentDark: ['accent', 'black', 85],
  accentDarker: ['accent', 'black', 70],
  accentLight: ['accent', 'white', 12]
}

// a file in the branding folder: a relative path, without .. or a scheme
const LOCAL = /^(?![/\\])(?!.*\.\.)[\w\-./]+$/
// where a link may go: a web page or an email address
const LINK = /^(https?:\/\/|mailto:)[^\s"'<>]+$/i
// a font family: names, quoted or not, separated by commas
const FONT = /^[\w\s,"'-]+$/

const text = (value, limit) => (typeof value === 'string' && value.trim() && value.length <= limit ? value.trim() : null)

/**
 * What the app applies of a branding.json: { variables: { name: value }, logos: [{ src, alt, href, height }],
 * footer: { text, links: [{ label, href }] }, favicon, stylesheet, problems: [message] }. folder is the branding
 * folder's address, which its files are given under; supports(property, value) is CSS.supports
 */
export function brandingFrom (config, { folder, supports }) {
  const problems = []
  const brand = { variables: {}, logos: [], footer: { text: null, links: [] }, favicon: null, stylesheet: null, problems }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    problems.push('branding.json is not an object')
    return brand
  }
  const file = (value, what) => {
    if (value == null) return null
    if (typeof value === 'string' && LOCAL.test(value)) return `${folder}${value}`
    problems.push(`${what} ${JSON.stringify(value)} is not a file in the branding folder`)
    return null
  }
  const link = (value, what) => {
    if (value == null) return null
    if (typeof value === 'string' && LINK.test(value)) return value
    problems.push(`${what} ${JSON.stringify(value)} is not a web or email address`)
    return null
  }

  const section = (name) => (config[name] && typeof config[name] === 'object' ? config[name] : {})
  for (const [key, value] of Object.entries(section('colors'))) {
    if (!(key in COLORS)) problems.push(`colors.${key} is not one of ${Object.keys(COLORS).join(', ')}`)
    else if (typeof value === 'string' && value.length < 100 && supports('color', value)) brand.variables[COLORS[key]] = value
    else problems.push(`colors.${key} ${JSON.stringify(value)} is not a colour`)
  }
  for (const [key, [from, other, percent]] of Object.entries(DERIVED)) {
    const base = brand.variables[COLORS[from]]
    if (base && !brand.variables[COLORS[key]]) brand.variables[COLORS[key]] = `color-mix(in srgb, ${base} ${percent}%, ${other})`
  }
  // the analysis workspace's accent (analysis.css) follows the brand's
  if (brand.variables['--brand-accent']) {
    brand.variables['--brand-analysis-accent'] = brand.variables['--brand-accent-dark']
    brand.variables['--brand-analysis-accent-soft'] = brand.variables['--brand-accent-light']
  }
  // links in the brand's primary colour, unless it gives them one; without either, as the browser shows them
  if (!brand.variables['--brand-link'] && brand.variables['--brand-primary']) brand.variables['--brand-link'] = brand.variables['--brand-primary']

  const font = section('font')
  const family = text(font.family, 200)
  if (family && FONT.test(family)) brand.variables['--brand-font'] = family
  else if (font.family != null) problems.push(`font.family ${JSON.stringify(font.family)} is not a font family`)
  // its font files, in the branding folder too
  brand.stylesheet = file(font.stylesheet, 'font.stylesheet')
  if (config.stylesheet != null) {
    if (brand.stylesheet) problems.push('font.stylesheet and stylesheet are both given: put the fonts in the stylesheet')
    else brand.stylesheet = file(config.stylesheet, 'stylesheet')
  }
  brand.favicon = file(config.favicon, 'favicon')

  for (const [i, logo] of (Array.isArray(config.logos) ? config.logos : []).entries()) {
    const src = file(logo?.src, `logos[${i}].src`)
    if (!src) continue
    const height = Number.isFinite(logo.height) ? Math.min(Math.max(logo.height, 16), 120) : 40
    brand.logos.push({ src, alt: text(logo.alt, 200) ?? '', href: link(logo.href, `logos[${i}].href`), height })
  }

  const footer = section('footer')
  brand.footer.text = text(footer.text, 500)
  for (const [i, entry] of (Array.isArray(footer.links) ? footer.links : []).entries()) {
    const label = text(entry?.label, 80)
    const href = link(entry?.href, `footer.links[${i}].href`)
    if (label && href) brand.footer.links.push({ label, href })
    else if (!label) problems.push(`footer.links[${i}] has no label`)
  }
  return brand
}
