// Chapter 7, "Analysing the results" (src/guide/chapters/analysing.md), the last of the this-season chain (manifest
// chains.this_season, guide/data/this-season.mjs): Bridget analyses the corrected 2026 heights by ANOVA, with each
// plot's germplasm and block, the nitrogen rate as categorical, and the estimated means of entries and rates; then edits
// and resubmits it as descriptive statistics of the ordinal Septoria score by entry: each score's count, and the
// quartiles as scores. Plays on from the checking chapter, with an analysis worker polling the API.
import { byText, openStudy, startsWith } from '../lib/storyboard.mjs'
import { recorded, season } from '../data/this-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'analysing',
  // the programme's lead, who reads Field Operations' datasets, signed in off camera
  account: 'bridget'
}

export async function check ({ page, session, manifest }) {
  const { typo } = manifest.chains.this_season
  const { study } = await season({ page, session, manifest })
  const heights = study ? await recorded({ page, session, manifest }, study, 'height') : {}
  if (heights[typo.plot] !== typo.correct) throw new Error(`${typo.plot}'s height is not corrected: play the checking chapter first`)
}

const HEIGHT = 'Plant height (cm)'
const NITROGEN = 'Nitrogen rate (kg N/ha)'
const SEPTORIA = 'Septoria leaf blotch score'

// the analysis editor's parts
const typeCard = (name) => `[...document.querySelectorAll('.type-card')].find((c) => c.querySelector('strong')?.innerText.trim() === ${q(name)})`
const datasetRow = (name) => `[...document.querySelectorAll('#analysis-data .dataset-row')].find((r) => r.innerText.includes(${q(name)}))`
const box = (title) => `[...document.querySelectorAll('.config-editor .box')].find((b) => b.querySelector('h4')?.innerText.trim() === ${q(title)})`
const fieldOf = (within, label) => `[...(${within}).querySelectorAll('.field')].find((f) => (f.querySelector('.field-label') ?? f.querySelector('label'))?.innerText.trim() === ${q(label)})`
const chip = (within, text) => `[...(${within}).querySelectorAll('.chip')].find((c) => c.innerText.trim() === ${q(text)})`
const addTerms = `document.querySelector('#analysis-terms .add-terms')`
const conceptSelect = `${addTerms}.querySelector('select')`
const term = (name) => `[...document.querySelectorAll('#analysis-terms .term')].find((t) => t.querySelector('.term-header strong')?.innerText.trim() === ${q(name)})`
const submitButton = `[...document.querySelectorAll('.submit-actions button')].find((b) => b.innerText.includes('Submit'))`
const status = `document.querySelector('.submission-view .title-row .status-badge')`

export async function run ({ page, input, step, manifest, app, recorder }) {
  const plan = manifest.chains.this_season
  const where = { programme: manifest.entities[plan.programme].name, trial: plan.trial.name, study: plan.study.name }

  // a concept of the chosen datasets, added as a term: its option is named with its scale
  const addConcept = async (name) => {
    const option = `[...(${conceptSelect})?.options ?? []].find((o) => o.text.trim().startsWith(${q(`${name} (`)}))`
    await page.waitFor(option, 30000)
    await input.choose(conceptSelect, await page.evaluate(`(${option}).text.trim()`))
    await input.click(byText('button', 'Add', addTerms))
    await page.waitFor(term(name), 10000)
    await input.pause(500)
  }
  // submitted, then followed until it completes
  const submit = async () => {
    await page.waitFor(`${submitButton} && !${submitButton}.disabled`, 30000)
    await input.hover('document.querySelector(".submit-bar")', 800)
    await input.click(submitButton)
    await page.waitFor(`!document.querySelector('.config-editor') && ${status}`, 60000)
    await input.pause(600)
    await input.hover(status, 600)
    await page.waitFor(`${status} && !${status}.classList.contains('running')`, 240000)
    const shown = await page.evaluate(`${status}.innerText.replace(/[^A-Za-z ]/g, '').trim()`)
    if (shown !== 'Completed') {
      throw new Error(`The analysis ${shown}: ${await page.evaluate(`document.querySelector('.submission-view').innerText.slice(0, 1500)`)}`)
    }
    await input.pause(1500)
  }

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
    const analyse = byText('.dataset-actions a', 'Analyse', cards.studyCard)
    await page.waitFor(analyse, 30000)
    await input.pause(800)
    await input.click(analyse)
    await page.waitFor(datasetRow(HEIGHT), 30000)
    await input.restoreCursor()
    await input.pause(1500)
    await input.type('document.querySelector("#analysis-name")', 'Plant height 2026')
    await input.pause(600)
  })

  await step('data', async () => {
    await input.click(typeCard('ANOVA'))
    await input.pause(900)
    for (const name of [HEIGHT, NITROGEN]) await input.click(`(${datasetRow(name)}).querySelector('input')`)
    await input.pause(1200)
  })

  await step('grouping', async () => {
    await input.click(`(${box('Germplasm')}).querySelector('.toggle input')`)
    await page.waitFor(`(${box('Germplasm')}).innerText.includes("each unit's own germplasm is a level")`, 10000)
    await input.hover(`(${box('Germplasm')}).querySelector('.hint:last-child')`, 1800)
    await input.click(`(${box('Position')}).querySelector('.toggle input')`)
    await page.waitFor(chip(box('Position'), 'Field'), 30000)
    await input.click(chip(box('Position'), 'Field'))
    const places = fieldOf(box('Position'), 'In the selected datasets')
    await page.waitFor(`(${places})?.querySelector('.place-name')`, 60000)
    await input.hover(`(${places}).querySelector('.places')`, 2200)
    await page.waitFor(chip(fieldOf(box('Position'), 'Layout axes (optional)'), 'Block'), 30000)
    await input.click(chip(fieldOf(box('Position'), 'Layout axes (optional)'), 'Block'))
    await input.pause(1000)
  })

  await step('terms', async () => {
    await addConcept(HEIGHT)
    await addConcept(NITROGEN)
    for (const domain of ['+ Germplasm', '+ Block']) {
      await page.waitFor(`${chip(addTerms, domain)} && !${chip(addTerms, domain)}.disabled`, 30000)
      await input.click(chip(addTerms, domain))
      await input.pause(400)
    }
    // the nitrogen rates as two levels, not a number
    await input.click(`(${term(NITROGEN)}).querySelector('.expand')`)
    const representation = `(${fieldOf(term(NITROGEN), 'Representation')}).querySelector('select')`
    await page.waitFor(representation, 10000)
    await input.choose(representation, 'categorical')
    await input.click(`(${term(NITROGEN)}).querySelector('.expand')`)
    await input.pause(500)
    const response = `(${fieldOf("document.querySelector('#analysis-options')", 'Response')}).querySelector('select')`
    await input.choose(response, HEIGHT)
    await input.pause(600)
    for (const means of ['Germplasm', NITROGEN]) {
      await input.click(startsWith('#analysis-options button', '+ Add estimated means'))
      const last = `[...document.querySelectorAll('#analysis-options .box')].at(-1)`
      await page.waitFor(chip(fieldOf(last, 'Means of'), means), 10000)
      await input.click(chip(fieldOf(last, 'Means of'), means))
      await input.pause(500)
    }
  })

  await step('results', async () => {
    await submit()
    const anova = `document.querySelector('.submission-view table.result-table')`
    await page.waitFor(anova, 30000)
    await input.hover(`${anova}.querySelector('tbody tr')`, 2500)
    recorder.poster()
    await input.hover(`${anova}.querySelector('tbody tr:nth-child(3)')`, 1800)
    // the means of the entries, then of the rates: each title brought into view, then its chart under it
    const means = (of) => `[...document.querySelectorAll('.submission-view .estimated-means .em-header h4')].find((e) => e.innerText.trim() === ${q(`${HEIGHT}: means of ${of}`)})`
    for (const of of ['Germplasm', NITROGEN]) {
      await page.waitFor(means(of), 30000)
      await input.hover(means(of), 600)
      await input.scroll(null, 300)
      await input.pause(2500)
    }
  })

  await step('further', async () => {
    await input.click(byText('.submission-view button', 'Edit & resubmit'))
    await page.waitFor(`document.querySelector('.config-editor') && ${datasetRow(SEPTORIA)}`, 30000)
    await input.restoreCursor()
    await input.pause(1200)
    await input.type('document.querySelector("#analysis-name")', 'Septoria 2026 by entry')
    await input.click(typeCard('Descriptive statistics'))
    await input.pause(600)
    // the Septoria scores in place of the heights and rates
    for (const name of [SEPTORIA, HEIGHT, NITROGEN]) await input.click(`(${datasetRow(name)}).querySelector('input')`)
    for (const name of [HEIGHT, NITROGEN, 'Block']) {
      await input.click(`(${term(name)}).querySelector('.term-header .danger')`)
      await page.waitFor(`!(${term(name)})`, 10000)
    }
    const meansBox = `[...document.querySelectorAll('#analysis-options .box')].find((b) => b.querySelector('h4')?.innerText.startsWith('Estimated means'))`
    while (await page.evaluate(`!!(${meansBox})`)) {
      await input.click(`(${meansBox}).querySelector('.box-header .danger')`)
      await input.pause(300)
    }
    await addConcept(SEPTORIA)
    await input.hover(`(${term(SEPTORIA)}).querySelector('.term-header')`, 1500)
    await submit()
    const table = `document.querySelector('.submission-view .ordinal-table')`
    await page.waitFor(table, 30000)
    // the score over all plots, then an entry's: its quartiles as scores, then across the table to each score's count
    const cell = (row, column) => `${table}.querySelectorAll('tbody tr')[${row}].querySelectorAll('td')[${column}]`
    await input.hover(cell(0, 0), 1200)
    await input.hover(cell(0, 5), 2500)
    await input.hover(cell(1, 5), 2000)
    await input.scroll(`${table}.querySelector('.table-wrapper')`, 600, { across: true })
    await input.hover(`${table}.querySelector('tbody tr.overall td.category.first')`, 2500)
  })
}
