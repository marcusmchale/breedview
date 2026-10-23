// An update clears an optional field emptied in its form (breedgraph 2026-10-23, README Updates): before, a field
// left empty was left out of the update, and so kept. A study's description and practices and a unit's description are
// set through the API, emptied in their edit forms, and checked through the API and on the page. Signed in as the
// writer, who curates the replicates study and the scenario's field unit; what they had is put back afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e, replicates as r } from './lib/fixture.mjs'

const q = JSON.stringify
const STUDY = String(r.study.id)
const UNIT = String(e.field_unit.id)

const studyOf = async () => (await graphql(page, 'query ($id: ID!) { programsStudy(id: $id) { result { description practices } } }', { id: STUDY })).result
const unitOf = async () => (await graphql(page, 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { name description positions { location { id } } } } }', { ids: [UNIT] })).result[0]

async function update(mutation, argument, input, value) {
  const payload = await graphql(page, `mutation ($v: ${input}!) { ${mutation}(${argument}: $v) { status errors { message } } }`, { v: value })
  assert.equal(payload.status, 'SUCCESS', `${mutation}: ${q(payload.errors)}`)
}
const updateStudy = (value) => update('programsUpdateStudy', 'study', 'StudyUpdate', { id: STUDY, ...value })
const updateUnit = (value) => update('unitsUpdateUnit', 'unit', 'UnitUpdate', { id: UNIT, ...value })

let browser, page, original
before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  original = { study: await studyOf(), unit: { description: (await unitOf()).description } }
})
after(async () => {
  try {
    if (original) {
      await updateStudy(original.study)
      await updateUnit(original.unit)
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

async function submitModal() {
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal')`, 30000)
  await page.sleep(1000)
}

test('study: emptying its description and practices in Edit clears them', async () => {
  await updateStudy({ description: 'E2E description to clear', practices: 'E2E practices to clear' })
  const programCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(r.program.name)})`
  const studyCard = `${programCard}.querySelector('.study-card')`
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`${programCard}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.trials-header').click()`)
  await page.waitFor(`${programCard}.querySelector('.trial-card .studies-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.studies-header').click()`)
  await page.waitFor(`${studyCard}?.querySelector('.study-actions')`, 30000)
  await page.waitFor(`${studyCard}.querySelector('.study-content').innerText.includes('E2E practices to clear')`, 30000)
  const mark = page.mark()

  await page.evaluate(`${studyCard}.querySelector('.study-actions button').click()`)
  await page.waitFor(`document.querySelector('.modal textarea[name=practices]')?.value === 'E2E practices to clear'`, 15000)
  await page.type('.modal textarea[name=description]', '')
  await page.type('.modal textarea[name=practices]', '')
  await submitModal()

  assert.deepEqual(await studyOf(), { description: null, practices: null }, 'both are cleared')
  const content = await page.evaluate(`${studyCard}.querySelector('.study-content').innerText`)
  assert.ok(!content.includes('E2E practices to clear') && !/Practices:/.test(content), `the card shows no practices: ${content}`)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('unit: emptying its description in Edit clears it', async () => {
  await updateUnit({ description: 'E2E unit description to clear' })
  const unit = await unitOf()
  const card = '.location-units-panel .details-card'
  const description = `[...document.querySelectorAll('${card} .fields-grid .field')].find((f) => f.querySelector('.field-label').textContent.trim() === 'Description')`
  await page.goto(`${config.appUrl}/units?location=${unit.positions[0].location.id}`)
  const block = `[...document.querySelectorAll('.block-item')].find((b) => b.querySelector('.block-name').innerText.trim() === ${q(unit.name)})`
  await page.waitFor(block, 30000)
  await page.evaluate(`${block}.click()`)
  await page.waitFor(`${description}?.querySelector('.field-value').textContent.includes('E2E unit description to clear')`, 30000)
  await page.waitFor(`[...document.querySelectorAll('${card} .card-actions button')].some((b) => b.innerText.includes('Edit'))`, 30000)
  const mark = page.mark()

  await page.evaluate(`[...document.querySelectorAll('${card} .card-actions button')].find((b) => b.innerText.includes('Edit')).click()`)
  await page.waitFor(`document.querySelector('.modal input[name=description]')?.value === 'E2E unit description to clear'`, 15000)
  await page.type('.modal input[name=description]', '')
  await submitModal()

  assert.equal((await unitOf()).description, null, 'the description is cleared')
  assert.equal(await page.evaluate(`!!${description}`), false, 'the card shows none')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
