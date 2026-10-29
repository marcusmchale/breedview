// Germplasm grouping in the analysis editor, as the writer, on the test database's dataset_public (breedgraph
// tests/breedgraph/scenarios/read_policy_scenario.py): ticked with no germplasm selected, each unit's own germplasm is
// a level, its own or inherited, so tree_public's record and those of the units below it are one level (crop_leaf)
// and tree_registered's another (crop_middle), each named in the results; the submission lists the dimension as each
// unit's own; and the control level of a contrast between them is picked from the germplasm. Needs the analysis
// worker (see README.md).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entity } from './lib/fixture.mjs'
import { formatNumber } from '../../src/components/analysis/results/format.js'

const q = JSON.stringify

let browser, page, conceptName
before(async () => {
  browser = await launchBrowser({ height: 2400 }); page = browser.page
  await loginAs(page, 'writer')
  const found = await graphql(page, 'query ($ids: [ID!]) { datasets(ids: $ids) { result { id concept { name } } } }',
    { ids: [String(entity('dataset_public').id)] })
  conceptName = found.result[0].concept.name
})
after(async () => {
  try {
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const option = (label) => `[...document.querySelectorAll('.options-list .option-label')].find((e) => e.innerText.trim().startsWith(${q(label)})).closest('.option-item')`
const germplasmBox = `[...document.querySelectorAll('#analysis-grouping .box')].find((b) => b.querySelector('h4')?.innerText.trim() === 'Germplasm')`
const termChip = (text) => `[...document.querySelectorAll('#analysis-terms .add-terms .chip')].find((c) => c.innerText.trim() === ${q(`+ ${text}`)})`
const submitButton = `[...document.querySelectorAll('.submit-actions button')].find((b) => b.innerText.includes('Submit'))`
const viewStatus = `document.querySelector('.submission-view .title-row .status-badge:not(.running)')`

// A new analysis of the dataset's concept, with its MEAN, so each unit is one observation
async function openEditor() {
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  for (const name of [entity('program').name, entity('trial').name]) {
    await page.evaluate(`${option(name)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  await page.evaluate(`${option(entity('study_public').name)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('#analysis-data .dataset-row input[value="${entity('dataset_public').id}"]')`, 60000)
  await page.click(`#analysis-data .dataset-row input[value="${entity('dataset_public').id}"]`)
  await page.waitFor(`[...document.querySelectorAll('#analysis-terms .add-terms select option')].some((o) => o.text.startsWith(${q(conceptName)}))`, 60000)
  await page.evaluate(`(() => { const s = document.querySelector('#analysis-terms .add-terms select'); s.value = [...s.options].find((o) => o.text.startsWith(${q(conceptName)})).value; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(200)
  await page.evaluate(`[...document.querySelectorAll('#analysis-terms .add-terms button')].find((b) => b.innerText.trim() === 'Add').click()`)
  await page.sleep(300)
  await page.click('#analysis-terms .term .expand')
  const aggregation = `[...document.querySelectorAll('#analysis-terms .term')[0].querySelectorAll('.field')].find((f) => f.querySelector('label')?.innerText.trim() === 'Aggregation').querySelector('select')`
  await page.waitFor(`[...${aggregation}.options].some((o) => o.value === 'MEAN')`, 30000)
  await page.evaluate(`(() => { const s = ${aggregation}; s.value = 'MEAN'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(200)
}

async function groupByOwnGermplasm() {
  await page.evaluate(`${germplasmBox}.querySelector('.toggle input').click()`)
  await page.waitFor(`${germplasmBox}.innerText.includes("None selected: each unit's own germplasm is a level")`, 10000)
  await page.waitFor(`${termChip('Germplasm')} && !${termChip('Germplasm')}.disabled`, 30000)
  await page.evaluate(`${termChip('Germplasm')}.click()`)
  await page.sleep(300)
}

async function submit() {
  await page.waitFor(`${submitButton} && !${submitButton}.disabled`, 30000)
  await page.evaluate(`${submitButton}.click()`)
  await page.waitFor(`!document.querySelector('.config-editor') && ${viewStatus}`, 180000)
  await page.sleep(1500)
  const shown = await page.evaluate(`document.querySelector('.submission-view').innerText`)
  assert.equal(await page.evaluate(`${viewStatus}.innerText.replace(/[^A-Za-z ]/g, '').trim()`), 'Completed', shown)
  return shown
}

// the result rows other than the overall one, by label: [n, mean] as the table shows them, once the germplasm levels
// are named: until their entries load, the table numbers them ("Germplasm 2")
const rows = async () => {
  await page.waitFor(`[...document.querySelectorAll('.submission-view table.result-table tbody tr td:first-child')]
    .every((td) => !/^Germplasm \\d+$/.test(td.innerText.trim()))`, 30000)
  return rowCells()
}
const rowCells = () => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.submission-view table.result-table tbody tr')]
  .map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()))
  .filter((cells) => cells[0] !== 'All observations')
  .map((cells) => [cells[0], [cells[1], cells[3]]]))`)

test('germplasm grouping with none selected takes each unit\'s own germplasm, its own or inherited', async () => {
  await openEditor()
  await groupByOwnGermplasm()
  const shown = await submit()
  assert.ok(shown.includes("Germplasm (each unit's own)"), 'the dimension is each unit\'s own germplasm')
  // tree_public (1) and the leaf (2) and rhizosphere (3) below it, which inherit its germplasm; tree_registered (4)
  assert.deepEqual(await rows(), {
    [entity('crop_leaf').name]: [formatNumber(3), formatNumber(2)],
    [entity('crop_middle').name]: [formatNumber(1), formatNumber(4)]
  })
})

const meansBox = `[...document.querySelectorAll('#analysis-options .box')].find((b) => b.querySelector('h4')?.innerText.trim() === 'Estimated means 1')`
const meansField = (label) => `[...${meansBox}.querySelectorAll('.field')].find((f) => (f.querySelector('.field-label') ?? f.querySelector('label'))?.innerText.trim() === ${q(label)})`
const pickerOption = (name) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(name)})`

test('with none selected, the control of a germplasm contrast is picked from the germplasm', async () => {
  await openEditor()
  await groupByOwnGermplasm()
  await page.evaluate(`[...document.querySelectorAll('#analysis-options button')].find((b) => b.innerText.includes('Add estimated means')).click()`)
  await page.waitFor(`!!${meansBox}`)
  await page.evaluate(`[...${meansField('Means of')}.querySelectorAll('.chip')].find((c) => c.innerText.trim() === 'Germplasm').click()`)
  await page.sleep(200)
  await page.evaluate(`(() => { const s = ${meansField('Contrasts')}.querySelector('select'); s.value = 'TRT_VS_CTRL'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  // the germplasm, not a box for the control's id
  await page.waitFor(`${meansField('Control level')}?.querySelector('.tree-multi-picker .select-trigger')`, 10000)
  assert.ok(!(await page.evaluate(`!!${meansField('Control level')}.querySelector('input[type=text]')`)), 'no box to type a level in')
  await page.evaluate(`${meansField('Control level')}.querySelector('.tree-multi-picker .select-trigger').click()`)
  for (const name of [entity('crop').name, entity('crop_middle').name]) {
    await page.waitFor(`${levelLoaded} && ${pickerOption(name)}?.querySelector('.expand-button')`, 30000)
    await page.evaluate(`${pickerOption(name)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
  }
  await page.waitFor(`${levelLoaded} && ${pickerOption(entity('crop_leaf').name)}?.querySelector('.option-checkbox')`, 30000)
  await page.evaluate(`${pickerOption(entity('crop_leaf').name)}.querySelector('.option-checkbox').click()`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  const shown = await submit()
  assert.ok(shown.includes('Contrasts against the control'), shown)
  const contrasts = await page.evaluate(`[...document.querySelectorAll('.submission-view tr')].map((tr) => tr.querySelector('td')?.innerText.replace(/\\s+/g, ' ').trim()).filter((t) => t?.includes('−'))`)
  assert.deepEqual(contrasts, [`${entity('crop_middle').name} − ${entity('crop_leaf').name}`])
})
