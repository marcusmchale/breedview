// The files of records on a complex scale, chosen in the references modal of the curation and dataset submission tables
// (f834a6c), on the spectra (manifest `spectra`; skipped without them), signed in as the writer, who curates them: the
// modal opens with the cell's files selected and listed by their descriptions, and the files saved are those the
// records cite, in curation over two saves in turn. A record cites at least one file, so its last can't be removed: the
// record is deleted instead, as the one submitted here is in curation. The curated record is put back to cite its own
// file before and after, and the submission study is left without records (datasets can't be deleted, so the dataset
// submitted stays there, empty).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { spectra as s, entities as e } from './lib/fixture.mjs'

const skip = s ? false : 'the test database manifest has no spectra: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify

// the tree_public record cites the first file; the second is the tree_registered record's
const [FIRST, SECOND] = Object.keys(s?.files ?? {})
const RECORD = s?.dataset.records.tree_public
const fileId = (name) => String(s.files[name].reference_id)
const SEARCH = 'Readpolicy canopy spectrum'

let browser, page
let submitted = null  // the dataset the submission test submits, whose record the last test deletes

const recordsOf = async (datasetId) => (await graphql(page,
  'query ($ids: [ID!]) { datasets(ids: $ids) { result { records { id unit { id } references { id } } } } }',
  { ids: [String(datasetId)] })).result[0].records
const citedBy = async (datasetId, recordId) =>
  (await recordsOf(datasetId)).find((record) => record.id === String(recordId)).references.map((reference) => reference.id).sort()

// datasetsUpdate and datasetsAddRecords are answered with a submission, processed in the background
async function completed (submissionId) {
  for (let i = 0; i < 100; i++) {
    const { result } = await graphql(page, 'query ($id: ID!) { datasetsSubmission(id: $id) { result { status errors } } }', { id: submissionId })
    if (result?.status === 'COMPLETED') return
    if (result?.status === 'FAILED') throw new Error(`the submission failed: ${q(result.errors)}`)
    await page.sleep(300)
  }
  throw new Error(`submission ${submissionId} did not complete`)
}

// The curated record cites its own file, as built: put back after a run, and before one, should the last have stopped
// part way. A record update gives its start, end and value with its references.
async function restoreRecord () {
  if (q(await citedBy(s.dataset.id, RECORD.id)) === q([fileId(FIRST)])) return
  const payload = await graphql(page, 'mutation ($d: DatasetUpdate!) { datasetsUpdate(dataset: $d) { status result errors { message } } }', {
    d: { id: String(s.dataset.id), records: [{ id: String(RECORD.id), start: RECORD.start, end: null, value: null, referenceIds: [fileId(FIRST)] }] }
  })
  assert.equal(payload.status, 'SUCCESS', q(payload.errors))
  await completed(payload.result)
}

// The datasets in the submission study, which holds only what these tests submit
const submissionDatasets = async () => (await graphql(page,
  'query ($studies: [ID!], $concepts: [ID!]) { datasets(studyIds: $studies, conceptIds: $concepts) { result { id } } }',
  { studies: [String(s.submission_study.id)], concepts: [String(s.concept.id)] })).result.map((dataset) => dataset.id)

// The submission study's datasets have no records before and after the tests (the last test deletes the one it submits)
async function emptySubmissionStudy () {
  for (const datasetId of await submissionDatasets()) {
    const recordIds = (await recordsOf(datasetId)).map((record) => record.id)
    if (recordIds.length) {
      await graphql(page, 'mutation ($id: ID!, $records: [ID!]!) { datasetsRemoveRecords(id: $id, recordIds: $records) { status } }',
        { id: String(datasetId), records: recordIds })
    }
  }
}

before(async () => {
  if (skip) return
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  await restoreRecord()
  await emptySubmissionStudy()
})
after(async () => {
  if (skip) return
  try {
    await restoreRecord()
    await emptySubmissionStudy()
  } finally {
    await logout(page); await browser?.close()
  }
})

// The references modal, over the curation or submission modal, which share its container's class
const refs = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim() === 'Manage References')`
const tab = (label) => `[...${refs}.querySelectorAll('.tabs .tab')].find((t) => t.innerText.includes(${q(label)}))`
const listed = (within) => page.evaluate(`[...${refs}.querySelectorAll(${q(`${within} .reference-item .reference-externalId`)})].map((e) => e.innerText.trim())`)

// The Selected tab, once the references selected by id alone (as the records read them) are read in full
async function openSelected () {
  await page.evaluate(`${tab('Selected')}.click()`)
  await page.waitFor(`${tab('Selected')}.classList.contains('active')`)
  await page.waitFor(`![...${refs}.querySelectorAll('.tab-content .reference-externalId')].some((e) => e.innerText.trim() === 'No description')`, 15000)
    .catch(() => {})  // the assertion on what is listed says what is missing
}

// Search for the files, and tick the one named: returns the files found, which leave out those selected
async function choose (name) {
  await page.evaluate(`${tab('Search')}.click()`)
  await page.waitFor(`${refs}.querySelector('.search-input')`)
  await page.evaluate(`(() => { const input = ${refs}.querySelector('.search-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(SEARCH)});
    input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  const result = `[...${refs}.querySelectorAll('.search-section .reference-item')].find((r) => r.querySelector('.reference-externalId')?.innerText.trim() === ${q(name)})`
  await page.waitFor(result, 30000)
  const found = await listed('.search-section')
  await page.evaluate(`${result}.querySelector('.select-checkbox input').click()`)
  return found
}

const save = async () => {
  await page.evaluate(`${refs}.querySelector('.modal-footer .btn-primary').click()`)
  await page.waitFor(`!(${refs})`)
}

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim().startsWith(${q(label)}))`

// In the open picker, down the path to the option to tick, then Done
async function pick (path, target) {
  for (const label of path) {
    await page.waitFor(`${levelLoaded} && ${option(label)}?.querySelector('.expand-button')`, 60000)
    await page.evaluate(`${option(label)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
  }
  await page.waitFor(`${levelLoaded} && ${option(target)}?.querySelector('.option-checkbox')`, 60000)
  await page.evaluate(`${option(target)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
}

// choose an option of a multiple select by its text
const select = (selector, text) => page.evaluate(`(() => { const s = document.querySelector(${q(selector)});
  [...s.options].find((o) => o.innerText.trim() === ${q(text)}).selected = true;
  s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)

const curationRow = (unit) => `[...document.querySelectorAll('.curation-table tbody tr')].find((r) => r.querySelector('td')?.innerText.trim() === ${q(unit)})`
const curationCell = (unit) => `${curationRow(unit)}?.querySelector('.complex-cell')`
const saveChanges = `document.querySelector('.table-footer .btn-primary')`

async function saveCuration () {
  await page.waitFor(`!${saveChanges}.disabled`)
  await page.evaluate(`${saveChanges}.click()`)
  await page.waitFor(`document.querySelector('.table-footer .saved-note')`, 60000)
}

// Curate the spectra study named, with the variable, until the table shows tree_public's row
async function curate (study) {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await pick([s.program.name, s.trial.name], study)
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 60000)
  await select('select[name=variableIds]', s.concept.name)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  const loadTable = `[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table'))`
  await page.waitFor(`!${loadTable}.disabled`, 30000)
  await page.evaluate(`${loadTable}.click()`)
  await page.waitFor(curationCell(e.tree_public.name), 60000)
}

test("curation: the modal opens with the cell's files selected, and the record cites those saved", { skip }, async () => {
  const mark = page.mark()
  await curate(s.study.name)

  const unit = e.tree_public.name
  assert.equal(await page.evaluate(`${curationCell(unit)}.querySelector('.file-count').innerText.trim()`), '1 file(s)')
  await page.evaluate(`${curationCell(unit)}.click()`)
  await page.waitFor(refs)
  assert.match(await page.evaluate(`${tab('Selected')}.innerText`), /Selected \(1\)/, 'the cell\'s file is selected')
  await openSelected()
  assert.deepEqual(await listed('.tab-content'), [FIRST])

  // a second file, from a search, which leaves out the one selected
  assert.deepEqual(await choose(SECOND), [SECOND])
  assert.match(await page.evaluate(`${tab('Selected')}.innerText`), /Selected \(2\)/)
  await save()
  assert.equal(await page.evaluate(`${curationCell(unit)}.querySelector('.file-count').innerText.trim()`), '2 file(s)')
  await saveCuration()
  assert.deepEqual(await citedBy(s.dataset.id, RECORD.id), [fileId(FIRST), fileId(SECOND)].sort())
  assert.equal(await page.evaluate(`${curationCell(unit)}.querySelector('.file-count').innerText.trim()`), '2 file(s)')

  // opened again, both are selected; removing the second, the record cites its own file again
  await page.evaluate(`${curationCell(unit)}.click()`)
  await page.waitFor(refs)
  assert.match(await page.evaluate(`${tab('Selected')}.innerText`), /Selected \(2\)/)
  await openSelected()
  assert.deepEqual((await listed('.tab-content')).sort(), [FIRST, SECOND].sort())
  const second = `[...${refs}.querySelectorAll('.tab-content .reference-item')].find((r) => r.querySelector('.reference-externalId').innerText.trim() === ${q(SECOND)})`
  await page.evaluate(`${second}.querySelector('.reference-header').click()`)
  await page.waitFor(`${second}.querySelector('.reference-actions .btn-warning')`)
  await page.evaluate(`${second}.querySelector('.reference-actions .btn-warning').click()`)
  assert.deepEqual(await listed('.tab-content'), [FIRST])
  await save()
  assert.equal(await page.evaluate(`${curationCell(unit)}.querySelector('.file-count').innerText.trim()`), '1 file(s)')
  await saveCuration()
  assert.deepEqual(await citedBy(s.dataset.id, RECORD.id), [fileId(FIRST)])
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  assert.deepEqual(await page.graphqlErrors(mark), [], 'no request was refused')
})

// opens a closed expansion header (they toggle) in the card
const openHeader = (card, header) => page.evaluate(`(() => {
  const h = ${card}.querySelector(${q(header)})
  if (h.querySelector('.expand-icon').innerText.includes('►')) h.click()
})()`)

const tableModal = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim().startsWith('Submit Datasets for'))`
const submissionCell = (unit) => `[...${tableModal}.querySelectorAll('.dataset-table tbody tr')].find((r) => r.querySelector('td')?.innerText.trim() === ${q(unit)})?.querySelector('.complex-cell')`

test("submission: the modal opens with the cell's files selected, and those saved are submitted", { skip }, async () => {
  await page.goto(`${config.appUrl}/programs`)
  const program = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(s.program.name)})`
  await page.waitFor(`${program}?.querySelector('.trials-header')`, 30000)
  await openHeader(program, '.trials-header')
  const trial = `[...${program}.querySelectorAll('.trial-card')].find((c) => c.innerText.includes(${q(s.trial.name)}))`
  await page.waitFor(`${trial}?.querySelector('.studies-header')`, 30000)
  await openHeader(trial, '.studies-header')
  const card = `[...${trial}.querySelectorAll('.study-card')].find((c) => c.innerText.includes(${q(s.submission_study.name)}))`
  await page.waitFor(`${card}?.querySelector('.section-toggle')`, 30000)
  await page.evaluate(`[...${card}.querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click()`)
  await page.waitFor(`[...${card}.querySelectorAll('button')].some((b) => b.innerText.includes('Create New Dataset'))`, 30000)
  await page.evaluate(`[...${card}.querySelectorAll('button')].find((b) => b.innerText.includes('Create New Dataset')).click()`)
  await page.waitFor(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger').length >= 2`, 30000)
  await page.sleep(1000)
  const mark = page.mark()

  // the field, and the tree there
  await page.evaluate(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[0].click()`)
  await pick([e.country.name, e.state.name], e.field.name)
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[1].click()`)
  await pick([e.field_unit.name], e.tree_public.name)
  await page.waitFor(`[...document.querySelectorAll('.dataset-submission-modal select[name=variableIds] option')].length > 0`, 30000)
  await select('.dataset-submission-modal select[name=variableIds]', s.concept.name)
  await page.waitFor(`!document.querySelector('.dataset-submission-modal .create-table-btn').disabled`)
  await page.click('.dataset-submission-modal .create-table-btn')

  const unit = e.tree_public.name
  await page.waitFor(submissionCell(unit), 30000)
  assert.equal(await page.evaluate(`${submissionCell(unit)}.querySelector('.file-count').innerText.trim()`), '📎 No files')
  await page.evaluate(`${submissionCell(unit)}.click()`)
  await page.waitFor(refs)
  assert.match(await page.evaluate(`${tab('Selected')}.innerText`), /Selected \(0\)/)
  assert.deepEqual((await choose(FIRST)).sort(), [FIRST, SECOND].sort())
  await save()
  assert.equal(await page.evaluate(`${submissionCell(unit)}.querySelector('.file-count').innerText.trim()`), '📎 1 file')

  // opened again, the file is selected, and listed by its description
  await page.evaluate(`${submissionCell(unit)}.click()`)
  await page.waitFor(refs)
  assert.match(await page.evaluate(`${tab('Selected')}.innerText`), /Selected \(1\)/)
  await openSelected()
  assert.deepEqual(await listed('.tab-content'), [FIRST])
  await page.evaluate(`${refs}.querySelector('.modal-footer .btn-secondary').click()`)
  await page.waitFor(`!(${refs})`)

  // the submission closes once its datasets are saved: the new one is found among the study's
  const before = await submissionDatasets()
  await page.evaluate(`[...${tableModal}.querySelectorAll('.modal-footer .btn-primary')].find((b) => b.innerText.includes('Submit All Datasets')).click()`)
  await page.waitFor(`!(${tableModal}) || ${tableModal}.querySelector('.status-indicator')?.innerText.includes('❌')`, 60000)
  assert.ok(!(await page.evaluate(`!!(${tableModal})`)), `the submission failed: ${await page.evaluate(`${tableModal}?.querySelector('.status-indicator')?.title`)}`)
  const [datasetId] = (await submissionDatasets()).filter((id) => !before.includes(id))
  assert.ok(datasetId, 'a dataset was submitted')
  submitted = datasetId
  assert.deepEqual(
    (await recordsOf(datasetId)).map((record) => ({ unit: record.unit.id, references: record.references.map((reference) => reference.id) })),
    [{ unit: String(e.tree_public.id), references: [fileId(FIRST)] }]
  )
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  assert.deepEqual(await page.graphqlErrors(mark), [], 'no request was refused')
})

test("curation: a record's last file can't be removed, but the record can be deleted, as the one submitted is", { skip }, async (t) => {
  if (!submitted) return t.skip('the submission test submitted nothing')
  const mark = page.mark()
  await curate(s.submission_study.name)
  const unit = e.tree_public.name
  const cell = curationCell(unit)
  const td = `${cell}.closest('td')`
  const recordId = (await recordsOf(submitted))[0].id
  assert.equal(await page.evaluate(`${cell}.querySelector('.file-count').innerText.trim()`), '1 file(s)')

  // its only file removed, the cell says to delete the record instead
  await page.evaluate(`${cell}.click()`)
  await page.waitFor(refs)
  await openSelected()
  const only = `${refs}.querySelector('.tab-content .reference-item')`
  await page.evaluate(`${only}.querySelector('.reference-header').click()`)
  await page.waitFor(`${only}.querySelector('.reference-actions .btn-warning')`)
  await page.evaluate(`${only}.querySelector('.reference-actions .btn-warning').click()`)
  await save()
  assert.equal(await page.evaluate(`${cell}.querySelector('.file-count').innerText.trim()`), '0 file(s)')
  assert.match(await page.evaluate(`${td}.title`), /cites at least one file: delete the record instead/)

  // saved anyway, the record is refused, and keeps its file
  await page.evaluate(`${saveChanges}.click()`)
  await page.waitFor(`document.querySelector('.curation-table thead .status-indicator.status-error')`, 60000)
  assert.match(await page.evaluate(`${td}.title`), /at least one reference: remove the record instead/)
  assert.deepEqual(await citedBy(submitted, recordId), [fileId(FIRST)])

  // marked for deletion it needs no file, and unmarked it does again; deleted, it is gone
  await page.evaluate(`${curationRow(unit)}.querySelector('.action-btn.delete').click()`)
  assert.ok(await page.evaluate(`${td}.classList.contains('marked-for-deletion') && !${td}.classList.contains('error-cell')`))
  await page.evaluate(`${curationRow(unit)}.querySelector('.action-btn.undo').click()`)
  assert.match(await page.evaluate(`${td}.title`), /delete the record instead/)
  await page.evaluate(`${curationRow(unit)}.querySelector('.action-btn.delete').click()`)
  await saveCuration()
  assert.deepEqual(await recordsOf(submitted), [])
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
