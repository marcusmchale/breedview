// Chapter 1, "Looking around as a visitor" (src/guide/chapters/looking-around.md): a visitor accepts the Terms, opens
// the public 2024 study and its data, then looks at the places and searches the map for one, then the units there,
// the plant material and the ontology.
// Nothing is changed, so it plays from any load of the demonstration database (manifest workflows.visitor_tour).
import { byText, clearOf, expandLocation, gatherLinked, loadStudyData, locationHeader, navLink, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify
// the 2024 trial's unit graph, which the Units step opens
const TRIAL_AREA = 'unit:Long Meadow 2024 trial area'

export const meta = {
  chapter: 'looking-around',
  // a visitor, who accepts the Terms on camera
  account: null,
  acceptTerms: false
}

export async function check ({ manifest }) {
  const tour = manifest.workflows.visitor_tour
  for (const key of [tour.programme, tour.trial, tour.study, tour.licence, tour.location, 'farm', TRIAL_AREA]) {
    if (!manifest.entities[key]?.readable_by.includes('anonymous')) throw new Error(`A visitor can't read ${key}`)
  }
}

export async function run ({ page, input, recorder, step, manifest, app }) {
  const names = Object.fromEntries(Object.entries(manifest.entities).map(([key, entity]) => [key, entity.name]))
  const tour = manifest.workflows.visitor_tour
  const study = { programme: names[tour.programme], trial: names[tour.trial], study: names[tour.study] }

  // the app's first page, off camera until it shows the Terms
  await recorder.hold(async () => {
    await page.goto(`${app}/`)
    await page.waitFor(`document.querySelector('.terms-gate input[name=termsAgreed]')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('terms', async () => {
    await input.pause(1200)
    await input.hover(byText('.terms-gate a', 'privacy notice'), 1200)
    await input.scroll('document.querySelector(".terms-gate .legal-text, .terms-gate .terms-text, .terms-gate")', 500)
    await input.pause(800)
    await input.click('document.querySelector(".terms-gate input[name=termsAgreed]")')
    await input.click('document.querySelector(".terms-gate button.accept")')
    // the app loads again once they are accepted
    await recorder.hold(async () => {
      await page.waitFor(`document.querySelector('[data-terms]')?.dataset.terms === 'accepted'`, 30000)
      await page.waitFor(`document.querySelector('.nav-menu .nav-link')`, 30000)
      await page.sleep(1000)
    })
    await input.restoreCursor()
  })

  let cards
  await step('programmes', async () => {
    cards = await openStudy({ page, input, ...study })
    await input.pause(800)
    await input.scroll(null, 380)
    await input.pause(2500)
  })

  await step('datasets', async () => {
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.view-datasets')`, 30000)
    await input.pause(800)
    await input.scroll(null, 260)
    await input.pause(3000)
  })

  // the table, shown as it loads: what more it does is the next chapter's
  await step('view', async () => {
    await input.click(`${cards.studyCard}.querySelector('.view-datasets')`)
    await loadStudyData({ page, input })
    await input.pause(3500)
    await input.click(`${byText('button', 'Close')} ?? document.querySelector('.modal-close, .close-btn')`)
    await page.waitFor(`!document.querySelector('.curation-table')`, 15000)
  })

  const expand = (name) => expandLocation({ page, input, name })

  await step('locations', async () => {
    await input.click(navLink('Locations'))
    await page.waitFor(`document.querySelector('.leaflet-container')`, 30000)
    await input.pause(1200)
    // the country first, which the map fits, then the farm, which it shows with its fields
    await page.waitFor(`${locationHeader(names.ireland)}?.querySelector('.location-name')`, 30000)
    await input.click(`${locationHeader(names.ireland)}.querySelector('.location-name')`)
    await input.pause(2200)
    await expand(names.ireland)
    await expand('County Offaly')
    await input.click(`${locationHeader(names.farm)}.querySelector('.location-name')`)
    await input.pause(4000)
    // the Cooperative's county is public, but its farm and field are not, so the county has nothing to open
    await input.click(`${locationHeader('County Kildare')}.querySelector('.location-name')`)
    await input.pause(3500)
  })

  // the map's search, anywhere: the county town among GeoNames' places, with what it is and where, then shown on the map
  await step('search', async () => {
    await input.type('document.querySelector(".place-search-input")', 'Tullamore')
    await input.pause(500)
    await input.click('document.querySelector(".place-search-form button[type=submit]")')
    const town = `[...document.querySelectorAll('.place-results .place-result:not(.location-result)')].find((e) => e.firstChild?.textContent.trim() === 'Tullamore')`
    await page.waitFor(town, 30000)
    await input.pause(1500)
    await input.hover(`${town}.querySelector('.place-result-detail')`, 2000)
    await input.hover('document.querySelector(".place-results-credit")', 1500)
    await input.click(town)
    await input.pause(4000)
  })

  await step('units', async () => {
    await input.click(navLink('Units'))
    await page.waitFor(`document.querySelector('.units-note') && ${locationHeader(names.ireland)}?.querySelector('.expand-btn')`, 30000)
    await input.pause(1000)
    await input.hover('document.querySelector(".units-note")', 2500)
    await expand(names.ireland)
    await expand('County Offaly')
    await expand(names.farm)
    await input.click(`${locationHeader(names[tour.location])}.querySelector('.location-name')`)
    const graph = byText('.block-item .block-name', names[TRIAL_AREA])
    await page.waitFor(graph, 30000)
    await input.pause(1200)
    await input.click(graph)
    // the trial area, opened to its plots
    const root = `${byText('.tree-panel .node-name', names[TRIAL_AREA])}?.closest('.node-header')`
    await page.waitFor(root, 30000)
    await input.pause(1000)
    const plot = `[...document.querySelectorAll('.tree-panel .node-name')].find((e) => e.innerText.trim().startsWith('LM24-'))`
    if (!(await page.evaluate(`!!(${plot})`))) {
      await input.click(`${root}.querySelector('.expand-btn')`)
      await page.waitFor(plot, 30000)
    }
    await input.pause(3500)
  })

  await step('germplasm', async () => {
    await input.click(navLink('Germplasm'))
    await page.waitFor(`document.querySelector('.search-box .search-input')`, 30000)
    await input.pause(2500)
    const line = names[tour.germplasm]
    await input.type('document.querySelector(".search-box .search-input")', line)
    await page.waitFor(`document.querySelector('.search-result-item')`, 15000)
    await input.click(byText('.search-result-item .result-name', line))
    await input.pause(2500)
    // clear of its neighbours, its parents and offspring show
    const node = `[...document.querySelectorAll('.germplasm-network-graph circle')].find((c) => c.__data__?.name === ${q(line)})`
    const by = await clearOf(page, {
      node, nodes: '.germplasm-network-graph circle', links: '.germplasm-network-graph line', frame: '.germplasm-network-graph svg'
    })
    await input.drag(node, { by })
    await input.pause(3500)
  })

  await step('ontology', async () => {
    await input.click(navLink('Ontology'))
    await page.waitFor(`document.querySelector('.search-box .search-input')`, 30000)
    await input.pause(2500)
    await input.type('document.querySelector(".search-box .search-input")', 'Plant height (cm)')
    await page.waitFor(`document.querySelector('.search-result-item')`, 15000)
    await input.click(byText('.search-result-item .result-name', 'Plant height (cm)'))
    await input.pause(1500)
    // the entry itself, whose card opens below the graph
    const node = `[...document.querySelectorAll('g.node')].find((g) => g.__data__?.name === 'Plant height (cm)')?.querySelector('circle')`
    await input.click(node)
    await page.waitFor(`document.querySelector('.card-container')`, 15000)
    await input.pause(800)
    // the graph is crowded: zoomed out a little, the variable to the clearest spot, then its trait, method and scale
    // beside it, each link labelled
    const graph = { nodes: '.ontology-network-graph g.node circle', frame: '.ontology-network-graph svg' }
    await input.scroll(null, 250, { at: { x: 1150, y: 260 } })
    await input.pause(800)
    await input.drag(node, { by: await clearOf(page, { node, ...graph, margin: 170 }) })
    await input.pause(1500)
    await gatherLinked({ page, input, node, links: '.ontology-network-graph .links line', ...graph, radius: 150 })
    await input.pause(3500)
    // down to the card, with the wheel in the page's margin: over the graph it zooms
    await input.scroll(null, 560, { at: { x: 1262, y: 560 } })
    await input.pause(4500)
  })

  await step('log-in', async () => {
    await input.hover('document.querySelector(".nav-login")', 1500)
    await input.click('document.querySelector(".nav-login")')
    await page.waitFor(`document.querySelector('input[name=username]')`, 15000)
    await input.pause(2500)
  })
}
