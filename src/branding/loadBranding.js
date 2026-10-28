import { reactive } from 'vue'

import { brandingFrom } from './brandingConfig'

// The branding applied, for the header's logos and the footer (App.vue): empty without a branding.json
export const branding = reactive({ logos: [], footer: { text: null, links: [] } })

/**
 * Reads branding/branding.json beside the app, under its base path, and applies it (brandingConfig.js): the colours
 * and font as CSS variables, its stylesheet and favicon, and its logos and footer for App.vue. Without one, as on the
 * demonstration site, nothing changes: a server that answers with the app's page instead, as a single-page app's
 * fallback does, counts as none. It never stops the app starting.
 */
export async function loadBranding () {
  const folder = `${import.meta.env.BASE_URL}branding/`
  let config
  try {
    const response = await fetch(`${folder}branding.json`, { cache: 'no-cache', signal: AbortSignal.timeout(5000) })
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return
    config = await response.json()
  } catch (error) {
    console.warn('The branding could not be read', error)
    return
  }
  const brand = brandingFrom(config, { folder, supports: (property, value) => CSS.supports(property, value) })
  for (const problem of brand.problems) console.warn(`branding.json: ${problem}`)

  for (const [name, value] of Object.entries(brand.variables)) document.documentElement.style.setProperty(name, value)
  // links take the brand's colour only once it gives one (global.css)
  document.documentElement.classList.toggle('brand-links', '--brand-link' in brand.variables)
  if (brand.stylesheet) {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: brand.stylesheet })
    document.head.append(link)
  }
  // the brand's favicon in place of BreedView's, both of them (index.html), or a browser would keep the SVG
  if (brand.favicon) {
    for (const icon of document.querySelectorAll('link[rel~="icon"]')) icon.remove()
    document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', href: brand.favicon }))
  }
  branding.logos = brand.logos
  branding.footer = brand.footer
}
