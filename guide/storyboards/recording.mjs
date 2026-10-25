// Chapter 5, "Recording observations" (src/guide/chapters/recording.md), the second of the this-season chain (manifest
// chains.this_season, guide/data/this-season.mjs): Theo submits data to Long Meadow Yield Trial 2026 for the 36 plots
// of the 2026 trial area, pasting the field sheet's nitrogen rates, heights and Septoria scores, LM26-207's typo
// included; the heights and scores get their columns' times, and each column becomes a dataset, controlled by Field
// Operations. Plays on from the setting-up chapter; the checking chapter goes on from it.
import { byText, openStudy, startsWith } from '../lib/storyboard.mjs'
import { recorded, season } from '../data/this-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'recording',
  // the field technician, signed in off camera
  account: 'theo'
}

export async function check ({ page, session, manifest }) {
  const { study } = await season({ page, session, manifest })
  if (!study) throw new Error('The 2026 study does not exist yet: play the setting-up chapter first')
  if (Object.keys(await recorded({ page, session, manifest }, study, 'height')).length) {
    throw new Error('The 2026 study has heights already: load the dump again')
  }
}

// In the open tree picker
const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
const trigger = (n) => `document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[${n}]`

export async function run ({ page, input, step, session, manifest, app, recorder }) {
  const plan = manifest.chains.this_season
  const where = { programme: manifest.entities[plan.programme].name, trial: plan.trial.name, study: plan.study.name }
  const theo = manifest.accounts[plan.actors.record]
  const location = manifest.entities[plan.location].name
  // the 2026 trial area, holding the plots
  const area = Object.keys(manifest.units).find((name) => manifest.units[name] === plan.area)
  const { height, septoria, nitrogen_rate: nitrogen } = plan.observations
  const value = (observation, plot) => Object.fromEntries(observation.values)[plot]
  const plots = plan.plots.map((plot) => plot.name).sort()
  // the field sheet: a plot a line, its nitrogen rate, height and Septoria score, as the table's columns are
  const sheet = plots.map((plot) => [nitrogen, height, septoria].map((o) => value(o, plot)).join('\t')).join('\n')

  const table = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim().startsWith('Submit Datasets for'))`
  const header = (observation) => `[...(${table}).querySelectorAll('thead th')].find((th) => th.dataset.column === 'concept_${observation.concept_id}')`
  const column = (observation) => `[...(${table}).querySelectorAll('thead th')].findIndex((th) => th.dataset.column === 'concept_${observation.concept_id}')`
  const cell = (plot, observation) => `[...(${table}).querySelectorAll('.dataset-table tbody tr')].find((r) => r.querySelector('td')?.innerText.trim() === ${q(plot)})?.querySelectorAll('td')[${column(observation)}]`

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  let cards
  await step('open', async () => {
    cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.submit-data')`, 30000)
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.submit-data')`)
    await page.waitFor(`${trigger(1)}`, 30000)
    await input.pause(1200)
  })

  await step('units', async () => {
    // the location, down its tree
    await input.click(trigger(0))
    for (const place of ['Ireland', 'County Offaly', 'Example Research Farm']) {
      await page.waitFor(`${levelLoaded} && ${option(place)}?.querySelector('.expand-button')`, 60000)
      await input.click(`${option(place)}.querySelector('.expand-button')`)
    }
    await page.waitFor(`${levelLoaded} && ${option(location)}`, 60000)
    await input.pause(500)
    await input.click(`${option(location)}.querySelector('.option-checkbox')`)
    await input.pause(500)
    await input.click('document.querySelector(".dropdown-panel .btn-done")')
    await page.waitFor(`!document.querySelector('.dropdown-panel')`, 10000)
    // the plots of the 2026 trial area, by their type
    await input.click(trigger(1))
    await page.waitFor(`${levelLoaded} && ${option(area)}?.querySelector('.expand-button')`, 60000)
    await input.pause(1500)
    await input.click(`${option(area)}.querySelector('.expand-button')`)
    await page.waitFor(`${levelLoaded} && ${option(plots[0])}`, 60000)
    await input.pause(1000)
    await input.click('document.querySelector(".dropdown-panel .select-by-type-button")')
    const plotType = `[...document.querySelectorAll('.type-panel .type-row')].find((r) => r.querySelector('.type-label')?.innerText.trim().startsWith('Plot'))`
    await page.waitFor(plotType, 30000)
    await input.hover(`(${plotType}).querySelector('.type-label')`, 1200)
    await input.click(byText('button', 'All', `(${plotType})`))
    await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('${plots.length} selected')`, 15000)
    await input.pause(1500)
    await input.click('document.querySelector(".dropdown-panel .btn-done")')
    await page.waitFor(`!document.querySelector('.dropdown-panel')`, 10000)
    await input.pause(800)
  })

  await step('concepts', async () => {
    const choice = (name, text) => `[...document.querySelector('.dataset-submission-modal select[name=${name}]').options].find((o) => o.text.trim() === ${q(text)})`
    await page.waitFor(`${choice('variableIds', 'Plant height (cm)')}`, 30000)
    await input.click(choice('factorIds', 'Nitrogen rate (kg N/ha)'))
    await input.click(choice('variableIds', 'Plant height (cm)'))
    await input.click(choice('variableIds', 'Septoria leaf blotch score'), { modifiers: ['Ctrl'] })
    await input.pause(1200)
  })

  await step('paste', async () => {
    await page.waitFor(`!document.querySelector('.dataset-submission-modal .create-table-btn').disabled`, 15000)
    await input.click('document.querySelector(".dataset-submission-modal .create-table-btn")')
    await page.waitFor(`(${table})?.querySelector('.dataset-table tbody tr td')`, 30000)
    await input.pause(1500)
    await input.paste(`(${cell(plots[0], nitrogen)}).querySelector('.cell-display')`, sheet, { heading: 'Copied from the field sheet: nitrogen, height, Septoria' })
    await page.waitFor(`(${cell(plots[0], septoria)})?.innerText.trim() === ${q(value(septoria, plots[0]))}`, 10000)
    await input.pause(1200)
    // down to the typo
    await input.scroll(cell(plots[0], nitrogen), 420)
    await page.waitFor(`(${cell(plan.typo.plot, height)})?.innerText.trim() === ${q(plan.typo.typed)}`, 10000)
    await input.hover(cell(plan.typo.plot, height), 2500)
  })

  await step('times', async () => {
    for (const [observation, start] of [[height, height.start], [septoria, septoria.start]]) {
      await input.click(`(${header(observation)}).querySelector('.column-time')`)
      await page.waitFor(`document.querySelector('.column-time-popover input[name=columnStart]')`, 10000)
      await input.pause(800)
      await input.type('document.querySelector(".column-time-popover input[name=columnStart]")', start)
      await input.pause(500)
      await input.click('document.querySelector(".column-time-popover .apply-time")')
      await page.waitFor(`!document.querySelector('.column-time-popover')`, 10000)
      await input.pause(800)
    }
    // which time a value takes, as pointing at it shows
    await input.tooltip(cell(plan.typo.plot, height), 2500)
    await input.hover(`(${header(nitrogen)}).querySelector('.column-time')`, 1500)
  })

  await step('submit', async () => {
    await input.click(startsWith(`.contributors-control button`, 'Contributors', `(${table})`))
    const field = `(${table}).querySelector('.contributors-panel .contributions-field')`
    await page.waitFor(`${field}?.querySelector('.field-header button')`, 10000)
    await input.click(`${field}.querySelector('.field-header button')`)
    await page.waitFor(`${field}.querySelector('.person-filter')`, 15000)
    await input.type(`${field}.querySelector('.person-filter')`, theo.fullname.split(' ')[0])
    const person = `[...${field}.querySelectorAll('.person-option')].find((o) => o.querySelector('.person-name')?.innerText.startsWith(${q(theo.fullname)}))`
    await page.waitFor(person, 15000)
    await input.click(`(${person}).querySelector('input')`)
    await input.click(`${field}.querySelector('.field-header button')`)
    const contribution = `[...${field}.querySelectorAll('.contribution')].find((c) => c.innerText.includes(${q(theo.fullname)}))`
    await page.waitFor(contribution, 10000)
    await input.click(`(${contribution}).querySelector('.role-menu summary')`)
    await input.click(`[...(${contribution}).querySelectorAll('.role-options label')].find((l) => l.innerText.trim() === 'Investigation')?.querySelector('input')`)
    await input.click(`(${contribution}).querySelector('.role-menu summary')`)
    await input.pause(600)
    await input.hover(`(${table}).querySelector('.modal-footer .control-selector')`, 2000)
    await input.click(byText('.modal-footer button', 'Submit All Datasets', `(${table})`))
    await page.waitFor(`!(${table}) || (${table}).querySelector('.status-indicator')?.innerText.includes('❌')`, 120000)
    const failed = await page.evaluate(`(${table})?.querySelector('.status-indicator')?.title ?? null`)
    if (failed) throw new Error(`The submission failed: ${failed}`)
    // the study's datasets, the new ones among them
    await page.waitFor(`${cards.studyCard}?.querySelector('.dataset-actions')`, 30000)
    await input.pause(1500)
    await input.scroll(null, 300)
    await input.hover(`${cards.studyCard}.querySelector('.dataset-actions')`, 3000)
  })

  // what the checking chapter starts from: the sheet's values, the typo among them
  const { study } = await season({ page, session, manifest })
  const heights = await recorded({ page, session, manifest }, study, 'height')
  if (heights[plan.typo.plot] !== plan.typo.typed || Object.keys(heights).length !== plots.length) {
    throw new Error(`The heights recorded are not the sheet's: ${JSON.stringify(heights)}`)
  }
}
