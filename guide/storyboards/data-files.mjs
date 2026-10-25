// Chapter 18, "Data files and downloads" (src/guide/chapters/data-files.md), independent (manifest
// workflows.data_files): Lena submits the NIR spectra of block 2's grain samples to Grain Quality 2025, uploading each
// sample's CSV (manifest uploads.nir_block_2) as a data file from its cell, two on camera and the others off camera;
// then, in curation, gets a link to one and downloads it. The demo holds other samples' spectra already. Plays from a
// fresh load of the demonstration database.
import { join } from 'node:path'
import { byText, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify
const breedgraph = new URL('../../../breedgraph/', import.meta.url).pathname

export const meta = {
  chapter: 'data-files',
  // the laboratory's scientist, of the Grain Quality Lab, signed in off camera
  account: 'lena'
}

// the day block 2's spectra were read, the day block 1's were in the demonstration database
const READ = '2025-09-24'
const DATASETS = 'query ($studies: [ID!], $concepts: [ID!]) { datasets(studyIds: $studies, conceptIds: $concepts) { result { records { unit { name } } } } }'

export async function check ({ page, session, manifest }) {
  const plan = manifest.workflows?.data_files
  if (!plan) throw new Error('The build has no data_files workflow')
  const { result } = await session.graphql(page, DATASETS, {
    studies: [String(manifest.entities[plan.study].id)], concepts: [String(manifest.ontology.entries.variables[plan.concept])]
  })
  // the demo has other samples' spectra: none of block 2's
  const samples = new Set(manifest.uploads[plan.uploads].map((upload) => upload.sample))
  if (result.some((dataset) => dataset.records.some((record) => samples.has(record.unit?.name)))) {
    throw new Error("Block 2's samples have NIR spectra already: load the dump again")
  }
}

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
const trigger = (n) => `document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[${n}]`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.workflows.data_files
  const uploads = manifest.uploads[plan.uploads]
  const laboratory = manifest.entities.laboratory.name
  const farm = manifest.entities.farm.name
  const arrival = `Arrived ${manifest.workflows.lab.arrival.start} at ${laboratory}`
  const where = { programme: manifest.entities.programme.name, trial: 'Advanced Yield Trial 2025', study: manifest.entities[plan.study].name }
  const table = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim().startsWith('Submit Datasets for'))`
  const refs = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim() === 'Manage References')`
  const cell = (sample) => `[...(${table}).querySelectorAll('.dataset-table tbody tr')].find((r) => r.querySelector('td')?.innerText.trim() === ${q(sample)})?.querySelector('.complex-cell')`
  // a sample's CSV, uploaded as a data file from its cell
  const upload = async ({ sample, path }) => {
    await input.click(cell(sample))
    await page.waitFor(`(${refs})?.querySelector('.tab')`, 15000)
    await input.pause(600)
    await input.click(`[...(${refs}).querySelectorAll('.tab')].find((t) => t.innerText.includes('Data File'))`)
    await page.waitFor(`(${refs}).querySelector('input[type=file]')`, 10000)
    await input.chooseFile(`(${refs}).querySelector('input[type=file]')`, join(breedgraph, path))
    await input.type(`(${refs}).querySelector('.tab-content textarea')`, `NIR spectrum of ${sample}`)
    await input.choose(`[...(${refs}).querySelectorAll('select')][0]`, 'CSV')
    await input.pause(600)
    await input.click(byText('.form-actions button', 'Upload', `(${refs})`))
    await page.waitFor(`[...(${refs}).querySelectorAll('.tab')].some((t) => t.innerText.includes('Selected (1)'))`, 60000)
    await input.pause(800)
    await input.click(startsWith('.modal-footer button', 'Save', `(${refs})`))
    await page.waitFor(`!(${refs}) && (${cell(sample)})?.innerText.includes('1 file')`, 15000)
    await input.pause(600)
  }

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  let cards
  await step('choose', async () => {
    cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.submit-data')`, 30000)
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.submit-data')`)
    await page.waitFor(trigger(1), 30000)
    await input.pause(1000)
    // the laboratory, down its location tree
    await input.click(trigger(0))
    for (const place of ['Ireland', 'County Offaly', farm]) {
      await page.waitFor(`${levelLoaded} && ${option(place)}?.querySelector('.expand-button')`, 60000)
      await input.click(`${option(place)}.querySelector('.expand-button')`)
    }
    await page.waitFor(`${levelLoaded} && ${option(laboratory)}`, 60000)
    await input.click(`${option(laboratory)}.querySelector('.option-checkbox')`)
    await input.pause(500)
    await input.click('document.querySelector(".dropdown-panel .btn-done")')
    await page.waitFor(`!document.querySelector('.dropdown-panel')`, 10000)
    // block 2's samples, from the grain that arrived there
    await input.click(trigger(1))
    await page.waitFor(`${levelLoaded} && (${option(arrival)} || ${option(laboratory)})`, 60000)
    if (await page.evaluate(`!${option(arrival)} && !!${option(laboratory)}?.querySelector('.expand-button')`)) {
      await input.click(`${option(laboratory)}.querySelector('.expand-button')`)
    }
    await page.waitFor(`${levelLoaded} && ${option(arrival)}?.querySelector('.expand-button')`, 60000)
    await input.pause(800)
    await input.click(`${option(arrival)}.querySelector('.expand-button')`)
    await page.waitFor(`${levelLoaded} && ${option(uploads[0].sample)}`, 60000)
    await input.pause(800)
    for (const { sample } of uploads) await input.click(`${option(sample)}.querySelector('.option-checkbox')`)
    await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('${uploads.length} selected')`, 15000)
    await input.pause(1000)
    await input.click('document.querySelector(".dropdown-panel .btn-done")')
    await page.waitFor(`!document.querySelector('.dropdown-panel')`, 10000)
    const variable = `[...document.querySelector('.dataset-submission-modal select[name=variableIds]').options].find((o) => o.text.trim() === 'NIR spectrum')`
    await page.waitFor(variable, 30000)
    await input.click(variable)
    await input.pause(1000)
  })

  await step('files', async () => {
    await page.waitFor(`!document.querySelector('.dataset-submission-modal .create-table-btn').disabled`, 15000)
    await input.click('document.querySelector(".dataset-submission-modal .create-table-btn")')
    await page.waitFor(cell(uploads[0].sample), 30000)
    await input.pause(1200)
    // the day the spectra were read, for the column, as block 1's were
    const header = `[...(${table}).querySelectorAll('thead th')].find((th) => th.dataset.column === 'concept_${manifest.ontology.entries.variables[plan.concept]}')`
    await input.click(`(${header}).querySelector('.column-time')`)
    await page.waitFor(`document.querySelector('.column-time-popover input[name=columnStart]')`, 10000)
    await input.type('document.querySelector(".column-time-popover input[name=columnStart]")', READ)
    await input.click('document.querySelector(".column-time-popover .apply-time")')
    await page.waitFor(`!document.querySelector('.column-time-popover')`, 10000)
    await input.pause(800)
    await upload(uploads[0])
    await upload(uploads[1])
    await recorder.offCamera(async () => {
      for (const file of uploads.slice(2)) await upload(file)
    }, { label: `Later: ${uploads.length - 2} more files` })
    await input.hover(`(${table}).querySelector('.dataset-table tbody')`, 2000)
    recorder.poster()
  })

  await step('submit', async () => {
    await input.click(byText('.modal-footer button', 'Submit All Datasets', `(${table})`))
    await page.waitFor(`!(${table}) || (${table}).querySelector('.status-indicator')?.innerText.includes('❌')`, 120000)
    const failed = await page.evaluate(`(${table})?.querySelector('.status-indicator')?.title ?? null`)
    if (failed) throw new Error(`The submission failed: ${failed}`)
    await page.waitFor(`${cards.studyCard}?.querySelector('.dataset-actions')`, 30000)
    await input.pause(1500)
    await input.hover(`${cards.studyCard}.querySelector('.dataset-actions')`, 2500)
  })

  await step('download', async () => {
    await input.click(`${cards.studyCard}.querySelector('.dataset-actions .view-datasets')`)
    const variable = `[...(document.querySelector('select[name=variableIds]')?.options ?? [])].find((o) => o.text.trim() === 'NIR spectrum')`
    await page.waitFor(variable, 30000)
    await input.pause(1000)
    await input.click(variable)
    const loadTable = byText('.selection-actions button', 'Load Table')
    await input.pause(1500)
    await page.waitFor(`document.querySelector('.licence-agreement input') || !(${loadTable})?.disabled`, 30000)
    if (await page.evaluate(`!!document.querySelector('.licence-agreement input')`)) {
      await input.click('document.querySelector(".licence-agreement label.agree input")')
      await input.click('document.querySelector(".licence-agreement button.accept-licences")')
      await page.waitFor(`!document.querySelector('.licence-agreement input') && !(${loadTable})?.disabled`, 30000)
    }
    await input.click(loadTable)
    // the first sample's file, among the spectra recorded before, from its cell's files
    const row = `[...document.querySelectorAll('.curation-table tbody tr')].find((r) => r.innerText.includes(${q(uploads[0].sample)}))`
    await page.waitFor(`(${row})?.querySelector('.complex-cell')`, 60000)
    await input.pause(1500)
    await input.click(`(${row}).querySelector('.complex-cell')`)
    await page.waitFor(`(${refs})?.querySelector('.tab')`, 15000)
    await input.pause(800)
    await input.click(`[...(${refs}).querySelectorAll('.tab')].find((t) => t.innerText.includes('Selected'))`)
    const getLink = `(${refs})?.querySelector('.tab-content button.download-btn')`
    await page.waitFor(getLink, 15000)
    await input.pause(1000)
    await input.hover(`(${getLink}).closest('.reference-item')`, 1500)
    await input.click(getLink)
    const link = `(${refs})?.querySelector('.tab-content a.download-btn')`
    await page.waitFor(link, 60000)
    await input.pause(1000)
    await input.fetchLink(link, { name: uploads[0].path.split('/').at(-1), ms: 4500 })
    await input.click(startsWith('.modal-footer button', 'Cancel', `(${refs})`))
  })
}
