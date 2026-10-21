// Position grouping in the analysis editor, on the test database's positions (manifest `positions`; skipped without
// them; breedgraph docs/test-databases.md, "The positions"): the location types of the ontology, the places the
// selected datasets reach at them with their layouts' axes, a Location and an axis term, results labelled by location
// name and by axis value with its layout, the records that can't be placed, and placing samples by their trees,
// kept on reopening. The outcomes are the manifest's `expected` cases, as the writer sees them.
// Needs the analysis worker (see README.md).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { manifest, positions as p, entities } from './lib/fixture.mjs'
import { formatNumber } from '../../src/components/analysis/results/format.js'

const skip = p ? false : 'the test database manifest has no positions: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const VIEWER = 'writer'

let browser, page
const names = {}
before(async () => {
  if (skip) return
  browser = await launchBrowser({ height: 2400 }); page = browser.page
  await loginAs(page, VIEWER)
  // the names the app shows: location types, subjects and the datasets' concepts
  const keys = ['ontology_location_field', 'ontology_location_country', 'ontology_subject_tree']
  const entries = await graphql(page, 'query ($ids: [ID!]) { ontologyEntries(ids: $ids) { result { ... on LocationType { id name } ... on Subject { id name } } } }',
    { ids: keys.map((k) => String(manifest.ids[k])) })
  for (const k of keys) names[k] = entries.result.find((e) => String(e.id) === String(manifest.ids[k])).name
  const found = await graphql(page, 'query ($ids: [ID!]) { datasets(ids: $ids) { result { id concept { name } } } }',
    { ids: Object.values(p.datasets).map(String) })
  for (const [key, id] of Object.entries(p.datasets)) names[key] = found.result.find((d) => String(d.id) === String(id)).concept.name
})
after(async () => {
  if (skip) return
  await logout(page); await browser?.close()
})

/* ---------- the editor ---------- */

const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const option = (label) => `[...document.querySelectorAll('.options-list .option-label')].find((e) => e.innerText.trim().startsWith(${q(label)})).closest('.option-item')`
const viewStatus = `document.querySelector('.submission-view .title-row .status-badge:not(.running)')`
const box = `[...document.querySelectorAll('#analysis-grouping .box')].find((b) => b.querySelector('h4')?.innerText.trim() === 'Position')`
const field = (label) => `[...${box}.querySelectorAll('.field')].find((f) => f.querySelector('.field-label')?.innerText.trim() === ${q(label)})`
const chip = (fieldLabel, text) => `[...${field(fieldLabel)}.querySelectorAll('.chip')].find((c) => c.innerText.trim() === ${q(text)})`
const termChip = (text) => `[...document.querySelectorAll('#analysis-terms .add-terms .chip')].find((c) => c.innerText.trim() === ${q(`+ ${text}`)})`

async function openEditor(dataset) {
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  for (const name of [p.program.name, p.trial.name]) {
    await page.evaluate(`${option(name)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  assert.ok((await optionLabels()).some((l) => l.startsWith(p.study.name)), 'the positions study is listed')
  await page.evaluate(`${option(p.study.name)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('#analysis-data .dataset-row input')`, 60000)
  await page.click(`#analysis-data .dataset-row input[value="${p.datasets[dataset]}"]`)
  const concept = names[dataset]
  await page.waitFor(`[...document.querySelectorAll('#analysis-terms .add-terms select option')].some((o) => o.text.startsWith(${q(concept)}))`, 60000)
  // the concept, with its MEAN, so a unit's records at one place are one observation
  await page.evaluate(`(() => { const s = document.querySelector('#analysis-terms .add-terms select'); s.value = [...s.options].find((o) => o.text.startsWith(${q(concept)})).value; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(200)
  await page.evaluate(`[...document.querySelectorAll('#analysis-terms .add-terms button')].find((b) => b.innerText.trim() === 'Add').click()`)
  await page.sleep(300)
  await page.click('#analysis-terms .term .expand')
  const aggregation = `[...document.querySelectorAll('#analysis-terms .term')[0].querySelectorAll('.field')].find((f) => f.querySelector('label')?.innerText.trim() === 'Aggregation').querySelector('select')`
  await page.waitFor(`[...${aggregation}.options].some((o) => o.value === 'MEAN')`, 30000)
  await page.evaluate(`(() => { const s = ${aggregation}; s.value = 'MEAN'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(200)
}

async function enablePosition() {
  await page.evaluate(`${box}.querySelector('.toggle input').click()`)
  await page.waitFor(field('Location types'), 30000)
}

async function clickChip(fieldLabel, text) {
  await page.waitFor(chip(fieldLabel, text), 60000)
  await page.evaluate(`${chip(fieldLabel, text)}.click()`)
  await page.sleep(300)
}

async function addTerm(text) {
  await page.waitFor(`${termChip(text)} && !${termChip(text)}.disabled`, 30000)
  await page.evaluate(`${termChip(text)}.click()`)
  await page.sleep(300)
}

const submitButton = `[...document.querySelectorAll('.submit-actions button')].find((b) => b.innerText.includes('Submit'))`

async function submit() {
  await page.waitFor(`${submitButton} && !${submitButton}.disabled`, 30000)
  await page.evaluate(`${submitButton}.click()`)
  await page.waitFor(`!document.querySelector('.config-editor') && ${viewStatus}`, 180000)
  await page.sleep(1500)
}

const statusLabel = () => page.evaluate(`${viewStatus}.innerText.replace(/[^A-Za-z ]/g, '').trim()`)
const messages = () => page.evaluate(`[...document.querySelectorAll('.submission-view .analysis-messages .message')].map((m) => ({
  code: m.querySelector('.message-header strong').innerText.trim(),
  text: m.innerText.replace(/\\s+/g, ' ').trim()
}))`)
// the result rows other than the overall one, by label: [n, mean] as the table shows them
const rows = () => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.submission-view table.result-table tbody tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()))
  .filter((cells) => cells[0] !== 'All observations')
  .map((cells) => [cells[0], [cells[1], cells[3]]]))`)

/* ---------- expected levels ---------- */

const locationName = (name) => entities[name]?.name ?? name
const levelLabel = (level) => level.location ? locationName(level.location) : `${level.axis} ${level.value} · ${level.layout}`
const expectedRows = (key) => Object.fromEntries(p.expected[key].levels[VIEWER].map((level) => [
  levelLabel(level), [formatNumber(level.count), formatNumber(level.mean)]
]))

async function assertCase(key) {
  const shown = await messages()
  assert.equal(await statusLabel(), 'Completed', q(shown))
  assert.deepEqual(await rows(), expectedRows(key))
  const unassigned = shown.find((m) => m.code === 'UNASSIGNED_POSITION')
  const count = p.expected[key].unassigned.length
  if (count) assert.match(unassigned?.text ?? '', new RegExp(`\\b${count} records`), q(shown))
  else assert.equal(unassigned, undefined, q(shown))
}

/* ---------- tests ---------- */

test('by field: the fields the records are at are listed with their layouts, and each record is in its field', { skip }, async () => {
  await openEditor('height')
  const mark = page.mark()
  await enablePosition()
  await clickChip('Location types', names.ontology_location_field)
  await page.waitFor(`${field('In the selected datasets')}?.querySelector('.place-name')`, 60000)
  const places = await page.evaluate(`[...${field('In the selected datasets')}.querySelectorAll('.place-name')].map((e) => e.innerText.trim())`)
  assert.deepEqual(places.sort(), Object.keys(p.locations).filter((name) => name.startsWith('Position Field')).sort(),
    'the three fields, not the greenhouse')
  assert.ok(await page.exists(chip('Layout axes (optional)', 'Row')), 'the axes of their layouts are offered')
  await addTerm('Location')
  await submit()
  await assertCase('fields')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('by row: each axis value is nested in its layout, and labelled with it', { skip }, async () => {
  await openEditor('height')
  await enablePosition()
  await clickChip('Location types', names.ontology_location_field)
  await clickChip('Layout axes (optional)', 'Row')
  await addTerm('Row')
  await submit()
  await assertCase('rows')
})

test('by country: a sample analysed abroad is in its lab\'s country, or by its tree in the tree\'s, kept on reopening', { skip }, async () => {
  await openEditor('width')
  await enablePosition()
  await clickChip('Location types', names.ontology_location_country)
  await addTerm('Location')
  await submit()
  await assertCase('countries')

  await page.clickText('Edit & resubmit')
  await page.waitFor(`document.querySelector('.config-editor')`)
  await page.waitFor(chip('Location types', names.ontology_location_country), 60000)
  assert.ok(await page.evaluate(`${chip('Location types', names.ontology_location_country)}.classList.contains('selected')`), 'the location type is kept')
  await clickChip('Place by (optional)', names.ontology_subject_tree)
  await submit()
  await assertCase('countries_by_tree')
})
