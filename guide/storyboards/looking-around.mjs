// Chapter 1, "Looking around as a visitor" (src/guide/chapters/looking-around.md): a visitor accepts the Terms, opens
// the public 2024 study and its data, then looks at the places, plant material and ontology. Nothing is changed, so it
// plays from any load of the demonstration database (manifest workflows.visitor_tour).
const q = JSON.stringify

export const meta = {
  chapter: 'looking-around',
  // a visitor, who accepts the Terms on camera
  account: null,
  acceptTerms: false
}

// an element by its text, read as shown with its spaces and line breaks taken as one space
const shown = 'e.innerText.replace(/\\s+/g, " ").trim()'
const byText = (selector, text, within = 'document') =>
  `[...${within}.querySelectorAll(${q(selector)})].find((e) => ${shown} === ${q(text)})`
const startsWith = (selector, text, within = 'document') =>
  `[...${within}.querySelectorAll(${q(selector)})].find((e) => ${shown}.startsWith(${q(text)}))`
const navLink = (text) => byText('.nav-menu .nav-link', text)

export async function check ({ manifest }) {
  const tour = manifest.workflows.visitor_tour
  for (const key of [tour.programme, tour.trial, tour.study, tour.licence, tour.location]) {
    if (!manifest.entities[key]?.readable_by.includes('anonymous')) throw new Error(`A visitor can't read ${key}`)
  }
}

export async function run ({ page, input, recorder, step, manifest, app }) {
  const names = Object.fromEntries(Object.entries(manifest.entities).map(([key, entity]) => [key, entity.name]))
  const tour = manifest.workflows.visitor_tour
  const programme = names[tour.programme]
  const trial = names[tour.trial]
  const study = names[tour.study]

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

  const programmeCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(programme)})`
  const trialCard = `[...(${programmeCard})?.querySelectorAll('.trial-card') ?? []].find((c) => c.innerText.includes(${q(trial)}))`
  const studyCard = `[...(${trialCard})?.querySelectorAll('.study-card') ?? []].find((c) => c.innerText.includes(${q(study)}))`

  await step('programmes', async () => {
    await input.click(navLink('Programs'))
    await page.waitFor(`${programmeCard}?.querySelector('.trials-header')`, 30000)
    await input.pause(1500)
    await input.click(`${programmeCard}.querySelector('.trials-header')`)
    await page.waitFor(`${trialCard}?.querySelector('.studies-header')`, 30000)
    await input.pause(1200)
    await input.click(`${trialCard}.querySelector('.studies-header')`)
    await page.waitFor(`${studyCard}?.querySelector('.section-toggle')`, 30000)
    await input.pause(800)
    await input.scroll(null, 380)
    await input.pause(2500)
  })

  await step('datasets', async () => {
    await input.click(startsWith('.section-toggle', '▶ Datasets', studyCard))
    await page.waitFor(`${byText('button', 'Curate', studyCard)}`, 30000)
    await input.pause(800)
    await input.scroll(null, 260)
    await input.pause(3000)
  })

  const loadTable = byText('.selection-actions button', 'Load Table')

  await step('curate', async () => {
    await input.click(byText('button', 'Curate', studyCard))
    await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 30000)
    await input.pause(1000)
    // every variable: the first, then the last with Shift
    const variable = (name) => `[...document.querySelector('select[name=variableIds]').options].find((o) => o.text.trim() === ${q(name)})`
    const options = await page.evaluate(`[...document.querySelector('select[name=variableIds]').options].map((o) => o.text.trim())`)
    await input.click(variable(options[0]))
    await input.click(variable(options.at(-1)), { modifiers: ['Shift'] })
    await input.pause(500)
    await input.click(`[...document.querySelector('select[name=factorIds]').options][0]`)
    await page.waitFor(`document.querySelector('.licence-agreement input')`, 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".licence-agreement")', 2200)
    await input.click('document.querySelector(".licence-agreement label.agree input")')
    await input.click('document.querySelector(".licence-agreement button.accept-licences")')
    await page.waitFor(`!document.querySelector('.licence-agreement input') && !(${loadTable})?.disabled`, 30000)
    await input.click(loadTable)
    await page.waitFor(`document.querySelector('.curation-table tbody tr td')`, 60000)
    await input.pause(2500)
  })

  const plotRow = (name) => `[...document.querySelectorAll('.curation-table tbody tr')].find((tr) => tr.querySelector('td')?.innerText.trim() === ${q(name)})`
  const columnOf = (header) => `[...document.querySelectorAll('.curation-table thead th')].findIndex((th) => th.textContent.trim().startsWith(${q(header)}))`
  const cellOf = (row, header) => `(${plotRow(row)}).querySelectorAll('td')[${columnOf(header)}]`
  // the 2024 trial's first plot
  const firstPlot = Object.keys(manifest.units).filter((name) => name.startsWith('LM24-')).sort()[0]

  await step('rows', async () => {
    await input.choose('document.querySelector("select[name=rowMode]")', 'Same year')
    await input.pause(1500)
    await input.tooltip(cellOf(firstPlot, 'Plant height (cm)'), 2200)
    await input.tooltip(cellOf(firstPlot, 'Grain yield (t/ha)'), 2000)
    await input.tooltip(`(${plotRow(firstPlot)}).querySelector('.applied-factor')`, 2600)
    await input.scroll('document.querySelector(".table-wrapper")', 600)
    await input.pause(1500)
    await input.click(`${byText('button', 'Close')} ?? document.querySelector('.modal-close, .close-btn')`)
    await page.waitFor(`!document.querySelector('.curation-table')`, 15000)
  })

  const locationHeader = (name) => `[...document.querySelectorAll('.location-header')].find((h) => h.querySelector('.location-name')?.innerText.trim() === ${q(name)})`
  const expand = async (name) => {
    await page.waitFor(`${locationHeader(name)}?.querySelector('.expand-btn')`, 30000)
    await input.click(`${locationHeader(name)}.querySelector('.expand-btn')`)
    await input.pause(700)
  }

  await step('locations', async () => {
    await input.click(navLink('Locations'))
    await page.waitFor(`document.querySelector('.leaflet-container')`, 30000)
    await input.pause(1200)
    // the country first, which the map fits, then down to the field
    await page.waitFor(`${locationHeader(names.ireland)}?.querySelector('.location-name')`, 30000)
    await input.click(`${locationHeader(names.ireland)}.querySelector('.location-name')`)
    await input.pause(2200)
    await expand(names.ireland)
    await expand('County Offaly')
    await expand(names.farm)
    await input.click(`${locationHeader(names[tour.location])}.querySelector('.location-name')`)
    await input.pause(3500)
    // the Cooperative's county is public, but its farm and field are not, so the county has nothing to open
    await input.click(`${locationHeader('County Kildare')}.querySelector('.location-name')`)
    await input.pause(3500)
  })

  await step('germplasm', async () => {
    await input.click(navLink('Germplasm'))
    await page.waitFor(`document.querySelector('.search-box .search-input')`, 30000)
    await input.pause(2500)
    await input.type('document.querySelector(".search-box .search-input")', names[tour.germplasm])
    await page.waitFor(`document.querySelector('.search-result-item')`, 15000)
    await input.click(byText('.search-result-item .result-name', names[tour.germplasm]))
    await input.pause(4000)
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
    await input.click(`[...document.querySelectorAll('g.node')].find((g) => g.__data__?.name === 'Plant height (cm)')?.querySelector('circle')`)
    await page.waitFor(`document.querySelector('.card-container')`, 15000)
    await input.pause(800)
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
