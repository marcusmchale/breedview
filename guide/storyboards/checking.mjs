// Chapter 6, "Checking and correcting data" (src/guide/chapters/checking.md), the third of the this-season chain
// (manifest chains.this_season, guide/data/this-season.mjs): Theo loads the 2026 heights, sorts them from the highest
// to find LM26-207's 830, corrects it to 83 and saves; then the dataset's controller, with its write history, and an
// export. Plays on from the recording chapter; the analysing chapter goes on from it.
import { byText, openStudy, startsWith } from '../lib/storyboard.mjs'
import { recorded, season } from '../data/this-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'checking',
  // the field technician, who curates Field Operations' datasets, signed in off camera
  account: 'theo'
}

export async function check ({ page, session, manifest }) {
  const { typo } = manifest.chains.this_season
  const { study } = await season({ page, session, manifest })
  const heights = study ? await recorded({ page, session, manifest }, study, 'height') : {}
  if (heights[typo.plot] !== typo.typed) throw new Error(`${typo.plot}'s height is not the typo: play the recording chapter first`)
}

export async function run ({ page, input, step, session, manifest, app, recorder }) {
  const plan = manifest.chains.this_season
  const { typo } = plan
  const where = { programme: manifest.entities[plan.programme].name, trial: plan.trial.name, study: plan.study.name }
  const HEIGHT = 'Plant height (cm)'
  const header = `[...document.querySelectorAll('.curation-table thead th')].find((th) => th.querySelector('.header-text')?.innerText.trim() === ${q(HEIGHT)})`
  const sorted = `(${header})?.querySelector('.sort-indicator')?.innerText.trim()`
  const row = `[...document.querySelectorAll('.curation-table tbody tr')].find((r) => r.querySelector('td')?.innerText.trim() === ${q(typo.plot)})`
  const cell = `(${row})?.querySelectorAll('td')[[...document.querySelectorAll('.curation-table thead th')].indexOf(${header})]`

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('open', async () => {
    const cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.view-datasets')`, 30000)
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.view-datasets')`)
    const variable = `[...(document.querySelector('select[name=variableIds]')?.options ?? [])].find((o) => o.text.trim() === ${q(HEIGHT)})`
    await page.waitFor(variable, 30000)
    await input.pause(1000)
    await input.click(variable)
    const loadTable = byText('.selection-actions button', 'Load Table')
    await page.waitFor(`!(${loadTable})?.disabled`, 30000)
    await input.pause(800)
    await input.click(loadTable)
    await page.waitFor(`document.querySelector('.curation-table tbody tr td')`, 60000)
    await input.pause(1500)
  })

  await step('sort', async () => {
    // from the lowest, then from the highest
    await input.click(header)
    await page.waitFor(`${sorted} === '↑'`, 10000)
    await input.pause(900)
    await input.click(header)
    await page.waitFor(`${sorted} === '↓'`, 10000)
    await page.waitFor(`document.querySelector('.curation-table tbody tr:not(.section-header):not(.spacer-row) td')?.innerText.trim() === ${q(typo.plot)}`, 10000)
    await input.pause(800)
    await input.hover(`(${cell}).querySelector('.cell-value')`, 2500)
    recorder.poster()
  })

  await step('correct', async () => {
    await input.click(`(${cell}).querySelector('.cell-value')`)
    await page.waitFor(`(${cell}).querySelector('input.cell-input')`, 10000)
    await input.type(`(${cell}).querySelector('input.cell-input')`, typo.correct)
    await input.key('Enter')
    await page.waitFor(`(${cell}).innerText.includes(${q(typo.correct)}) && !(${cell}).querySelector('input.cell-input')`, 10000)
    await input.pause(1200)
    const save = byText('.table-footer button', 'Save Changes')
    await page.waitFor(`!(${save})?.disabled`, 10000)
    await input.click(save)
    await page.waitFor(`document.querySelector('.table-footer .saved-note') || document.querySelector('.curation-table-container .error-message')`, 60000)
    const error = await page.evaluate(`document.querySelector('.curation-table-container .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The correction was not saved: ${error}`)
    await input.hover('document.querySelector(".table-footer .saved-note")', 2000)
  })

  await step('controller', async () => {
    await input.click(`(${cell}).querySelector('.controller-badge-mini')`)
    await page.waitFor(`document.querySelector('.controller-modal .controller-details')`, 30000)
    await input.pause(1000)
    const section = (title) => `[...document.querySelectorAll('.controller-modal .section')].find((s) => s.querySelector('strong')?.innerText.trim() === ${q(title)})`
    await input.hover(`(${section('Controls:')}).querySelector('.list-item')`, 2200)
    await input.hover(`(${section('Write History:')}).querySelector('.list')`, 3200)
    await input.click('document.querySelector(".controller-modal .modal-close")')
    await page.waitFor(`!document.querySelector('.controller-modal')`, 10000)
    await input.pause(600)
  })

  await step('export', async () => {
    await input.download(byText('.toolbar button', '📥 Export CSV'), { ms: 4500 })
    await input.pause(800)
  })

  const { study } = await season({ page, session, manifest })
  const heights = await recorded({ page, session, manifest }, study, 'height')
  if (heights[typo.plot] !== typo.correct) throw new Error(`${typo.plot}'s height is ${heights[typo.plot]}, not ${typo.correct}`)
}
