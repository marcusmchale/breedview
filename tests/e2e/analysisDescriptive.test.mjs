// Descriptive statistics need a continuous concept term to describe, as the writer, on the test database's
// dataset_public: its concept taken as categorical only groups, so the editor says so, and the analysis fails before it
// is queued, saying why (breedgraph ObservationBuilder.check_described). Needs no worker.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entity } from './lib/fixture.mjs'

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
const field = (term, label) => `[...${term}.querySelectorAll('.field')].find((f) => f.querySelector('label')?.innerText.trim() === ${q(label)})`
const submitButton = `[...document.querySelectorAll('.submit-actions button')].find((b) => b.innerText.includes('Submit'))`
const HINT = 'Descriptive statistics describe continuous concept terms: ordinal and categorical ones only group them.'

test('descriptive statistics of a concept taken as categorical are hinted against, and fail saying why', async () => {
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  assert.ok(await page.evaluate(`document.querySelector('.type-card.selected')?.innerText.includes('Descriptive statistics')`), 'the default type')
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
  await page.evaluate(`[...document.querySelectorAll('#analysis-terms .add-terms button')].find((b) => b.innerText.trim() === 'Add').click()`)
  await page.waitFor(`document.querySelector('#analysis-terms .term .expand')`, 10000)
  const hints = () => page.evaluate(`[...document.querySelectorAll('.submit-bar .problems li')].map((li) => li.innerText.trim())`)
  assert.ok(!(await hints()).includes(HINT), 'a continuous concept term is described')

  // the concept as categorical: nothing left to describe
  await page.click('#analysis-terms .term .expand')
  const term = `document.querySelectorAll('#analysis-terms .term')[0]`
  await page.waitFor(`${field(term, 'Representation')}?.querySelector('select')`, 10000)
  await page.evaluate(`(() => { const s = ${field(term, 'Representation')}.querySelector('select'); s.value = 'CATEGORICAL'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`[...document.querySelectorAll('.submit-bar .problems li')].some((li) => li.innerText.trim() === ${q(HINT)})`, 10000)

  const mark = page.mark()
  await page.waitFor(`${submitButton} && !${submitButton}.disabled`, 30000)
  await page.evaluate(`${submitButton}.click()`)
  // prepared before it is queued, so it fails without a worker
  const status = `document.querySelector('.submission-view .title-row .status-badge:not(.running)')`
  await page.waitFor(`!document.querySelector('.config-editor') && ${status}`, 60000)
  assert.equal(await page.evaluate(`${status}.innerText.replace(/[^A-Za-z ]/g, '').trim()`), 'Failed')
  const messages = await page.evaluate(`[...document.querySelectorAll('.submission-view .analysis-messages .message')].map((m) => m.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.ok(messages.some((m) => m.includes('INCOMPATIBLE_SCALE') && m.includes('Descriptive statistics describe CONTINUOUS concept terms, and none is')), q(messages))
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
