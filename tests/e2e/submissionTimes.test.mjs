// Times in the dataset submission table (src/composables/datasets/submissionTimes.js), on the spectra's submission
// study (manifest `spectra`; skipped without it), signed in as the writer, who curates it. Tree Height's column is given
// a time of its own, and another column of it a later one; Canopy Width's has none, so its value takes the row's Start.
// Pointing at a value says which time it takes, and once submitted each record has that time. Then two rows a unit,
// round by round: every unit once, then again, numbered in Round, and a round's Start filled alone. The records
// submitted are removed afterwards; their datasets stay, empty, as the references test's do.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { spectra as s, entities as e, manifest } from './lib/fixture.mjs'

const skip = s ? false : 'the test database manifest has no spectra: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const HEIGHT = { id: String(manifest.ids.ontology_variable_height), name: 'Tree Height (mm)' }
const WIDTH = { id: String(manifest.ids.ontology_variable_width), name: 'Canopy Width (mm)' }

let browser, page

// The submission study's records of these variables, by dataset
const recordsOf = async (concept) => (await graphql(page,
  'query ($studies: [ID!], $concepts: [ID!]) { datasets(studyIds: $studies, conceptIds: $concepts) { result { id records { id unit { id } value start end } } } }',
  { studies: [String(s.submission_study.id)], concepts: [concept.id] })).result

// none before or after the tests: those submitted are removed
async function removeRecords () {
  for (const concept of [HEIGHT, WIDTH]) {
    for (const dataset of await recordsOf(concept)) {
      if (!dataset.records.length) continue
      await graphql(page, 'mutation ($id: ID!, $records: [ID!]!) { datasetsRemoveRecords(id: $id, recordIds: $records) { status } }',
        { id: dataset.id, records: dataset.records.map((record) => record.id) })
    }
  }
}

before(async () => {
  if (skip) return
  browser = await launchBrowser({ width: 1600, height: 1400 }); page = browser.page
  await loginAs(page, 'writer')
  await removeRecords()
})
after(async () => {
  if (skip) return
  try {
    await removeRecords()
  } finally {
    await logout(page); await browser?.close()
  }
})

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim().startsWith(${q(label)}))`

// In the open picker, down the path to the options to tick, then Done
async function pick (path, targets) {
  for (const label of path) {
    await page.waitFor(`${levelLoaded} && ${option(label)}?.querySelector('.expand-button')`, 60000)
    await page.evaluate(`${option(label)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
  }
  for (const target of targets) {
    await page.waitFor(`${levelLoaded} && ${option(target)}?.querySelector('.option-checkbox')`, 60000)
    await page.evaluate(`${option(target)}.querySelector('.option-checkbox').click()`)
  }
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('${targets.length} selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
}

// choose options of a multiple select by their text
const select = (selector, texts) => page.evaluate(`(() => { const s = document.querySelector(${q(selector)});
  [...s.options].forEach((o) => { o.selected = ${q(texts)}.includes(o.innerText.trim()) });
  s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)

// opens a closed expansion header (they toggle) in the card
const openHeader = (card, header) => page.evaluate(`(() => {
  const h = ${card}.querySelector(${q(header)})
  if (h.querySelector('.expand-icon').innerText.includes('►')) h.click()
})()`)

const tableModal = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim().startsWith('Submit Datasets for'))`
const rowOf = (unit, nth = 0) => `[...${tableModal}.querySelectorAll('.dataset-table tbody tr')].filter((r) => r.querySelector('td')?.innerText.trim() === ${q(unit)})[${nth}]`
const columnIndex = (key) => `[...${tableModal}.querySelectorAll('thead th')].findIndex((th) => th.dataset.column === ${q(key)})`
const cellOf = (unit, key, nth = 0) => `${rowOf(unit, nth)}.querySelectorAll('td')[${columnIndex(key)}]`

// Submit data on the submission study, at the field, for the units and variables given
async function openTable (units, concepts, { rowsPerUnit = 1, order = 'unit' } = {}) {
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
  await page.waitFor(`${card}.querySelector('.submit-data')`, 30000)
  await page.evaluate(`${card}.querySelector('.submit-data').click()`)
  await page.waitFor(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger').length >= 2`, 30000)
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[0].click()`)
  await pick([e.country.name, e.state.name], [e.field.name])
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.dataset-submission-modal .hierarchical-multiselect .select-trigger')[1].click()`)
  // the field holds the lab and its store, which have arrivals, so its place comes first
  await pick([e.field.name, e.field_unit.name], units)
  await page.waitFor(`[...document.querySelectorAll('.dataset-submission-modal select[name=variableIds] option')].length > 0`, 30000)
  await select('.dataset-submission-modal select[name=variableIds]', concepts.map((concept) => concept.name))
  if (rowsPerUnit > 1) {
    await page.evaluate(`(() => { const input = document.querySelector('#rowsPerUnit');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(String(rowsPerUnit))});
      input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
    await page.waitFor(`document.querySelector('.rows-order input[value=${order}]')`, 15000)
    await page.click(`.rows-order input[value=${order}]`)
  }
  await page.waitFor(`!document.querySelector('.dataset-submission-modal .create-table-btn').disabled`)
  await page.click('.dataset-submission-modal .create-table-btn')
  await page.waitFor(`${tableModal}?.querySelector('.dataset-table tbody tr td')`, 30000)
  await page.sleep(500)
}

// A cell's value typed in, as a person would: click, type, Enter
async function enter (unit, key, value, nth = 0) {
  await page.evaluate(`${cellOf(unit, key, nth)}.querySelector('.cell-display').click()`)
  await page.waitFor(`${cellOf(unit, key, nth)}.querySelector('input.cell-input')`, 5000)
  await page.evaluate(`(() => { const input = ${cellOf(unit, key, nth)}.querySelector('input.cell-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })()`)
  await page.waitFor(`${cellOf(unit, key, nth)}.innerText.trim() === ${q(value)}`, 5000)
}

// A column's time, set in its popover
async function setColumnTime (start) {
  await page.waitFor(`document.querySelector('.column-time-popover input[name=columnStart]')`, 5000)
  await page.evaluate(`(() => { const input = document.querySelector('.column-time-popover input[name=columnStart]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(start)});
    input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.click('.column-time-popover .apply-time')
  await page.waitFor(`!document.querySelector('.column-time-popover')`, 5000)
}

const headerTime = (key) => page.evaluate(`[...${tableModal}.querySelectorAll('thead th')].find((th) => th.dataset.column === ${q(key)}).querySelector('.column-time').innerText.trim()`)

test("a column's time, another column of the variable at another time, and the row's Start where a column has none", { skip }, async () => {
  const mark = page.mark()
  const unit = e.tree_public.name
  await openTable([unit], [HEIGHT, WIDTH])
  assert.match(await page.text('.times-help'), /A value takes its column's time/)
  const height = `concept_${HEIGHT.id}`
  const width = `concept_${WIDTH.id}`
  assert.equal(await headerTime(height), '📅 Row times')

  // Tree Height at a time of its own, and another column of it, whose time is asked for at once
  await page.evaluate(`[...${tableModal}.querySelectorAll('thead th')].find((th) => th.dataset.column === ${q(height)}).querySelector('.column-time').click()`)
  await setColumnTime('2026-06-25')
  assert.equal(await headerTime(height), '📅 2026-06-25')
  await page.evaluate(`[...${tableModal}.querySelectorAll('thead th')].find((th) => th.dataset.column === ${q(height)}).querySelector('.another-time').click()`)
  // the same time again is refused
  await page.waitFor(`document.querySelector('.column-time-popover input[name=columnStart]')`, 5000)
  await page.evaluate(`(() => { const input = document.querySelector('.column-time-popover input[name=columnStart]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-06-25');
    input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.column-time-popover .error-message')?.innerText.includes('has this time')`, 5000)
  await setColumnTime('2026-07-10')
  const later = `${height}_2`
  assert.deepEqual(await page.evaluate(`[...${tableModal}.querySelectorAll('thead th')].filter((th) => th.dataset.column?.startsWith('concept_')).map((th) => th.dataset.column)`),
    [height, later, width], "the variable's columns side by side")
  assert.equal(await headerTime(later), '📅 2026-07-10')

  await enter(unit, 'startTime', '2026-06-03')
  await enter(unit, height, '84')
  await enter(unit, later, '91')
  await enter(unit, width, '30')
  const title = (key) => page.evaluate(`${cellOf(unit, key)}.title`)
  assert.equal(await title(height), "At 2026-06-25: its column's time")
  assert.equal(await title(later), "At 2026-07-10: its column's time")
  assert.equal(await title(width), "At 2026-06-03: its row's Start and End")

  await page.evaluate(`[...${tableModal}.querySelectorAll('.modal-footer .btn-primary')].find((b) => b.innerText.includes('Submit All Datasets')).click()`)
  await page.waitFor(`!(${tableModal}) || ${tableModal}.querySelector('.status-indicator')?.innerText.includes('❌')`, 60000)
  assert.ok(!(await page.evaluate(`!!(${tableModal})`)), `the submission failed: ${await page.evaluate(`${tableModal}?.querySelector('.status-indicator')?.title`)}`)
  const submitted = async (concept) => (await recordsOf(concept)).flatMap((dataset) => dataset.records)
    .map((record) => [record.unit.id, record.value, record.start, record.end]).sort()
  assert.deepEqual(await submitted(HEIGHT), [[String(e.tree_public.id), '84', '2026-06-25', null], [String(e.tree_public.id), '91', '2026-07-10', null]])
  assert.deepEqual(await submitted(WIDTH), [[String(e.tree_public.id), '30', '2026-06-03', null]])
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  assert.deepEqual(await page.graphqlErrors(mark), [], 'no request was refused')
})

test('two rows a unit, round by round: every unit once, then again, and a round filled alone', { skip }, async () => {
  const units = [e.tree_public.name, e.tree_registered.name]
  await openTable(units, [WIDTH], { rowsPerUnit: 2, order: 'round' })
  const rows = await page.evaluate(`[...${tableModal}.querySelectorAll('.dataset-table tbody tr')].filter((r) => r.querySelector('td'))
    .map((r) => [r.querySelector('td').innerText.trim(), r.querySelectorAll('td')[${columnIndex('round')}].innerText.trim()])`)
  assert.deepEqual(rows.map(([, round]) => round), ['1', '1', '2', '2'])
  assert.deepEqual(rows.slice(2).map(([unit]) => unit), rows.slice(0, 2).map(([unit]) => unit), 'each round lists the units in the same order')
  assert.deepEqual(rows.slice(0, 2).map(([unit]) => unit).sort(), [...units].sort())
  assert.match(await page.text('.times-help'), /round by round: every unit once, then again/)

  // the second round's Start, filled alone
  await page.evaluate(`[...${tableModal}.querySelectorAll('thead th')].find((th) => th.dataset.column === 'startTime').querySelector('.bulk-fill-btn').click()`)
  await page.waitFor(`document.querySelector('.bulk-fill-input')`, 5000)
  await page.evaluate(`(() => { const input = document.querySelector('.bulk-fill-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-07-01');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const round = document.querySelector('select[name=bulkFillRound]');
    round.value = [...round.options].find((o) => o.innerText.trim() === 'Round 2').value;
    round.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.click('.popover-actions .btn-primary')
  const starts = await page.evaluate(`[...${tableModal}.querySelectorAll('.dataset-table tbody tr')].filter((r) => r.querySelector('td'))
    .map((r) => r.querySelectorAll('td')[${columnIndex('startTime')}].innerText.trim())`)
  assert.deepEqual(starts, ['', '', '2026-07-01', '2026-07-01'])
})
