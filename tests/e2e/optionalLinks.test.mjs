// An update removes an optional link with null (breedgraph 2026-10-20): a study's design and licence, a unit's
// germplasm and a germplasm entry's origin. Each link is set through the API, removed in its edit form, and checked
// through the API and on the page. Signed in as the writer, who curates the child team's study, unit and entry; the
// links they had are put back afterwards. The test database publishes no design, and a study can't be linked to a draft
// (breedgraph 2026-10-23), so a design is created and committed once, by the admin, an ontology admin, and stays.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e, replicates as r } from './lib/fixture.mjs'

const q = JSON.stringify
const STUDY = String(r.study.id)
const UNIT = String(e.field_unit.id)
const ENTRY = String(e.crop_middle.id)
const DESIGN = 'E2E optional links design'

const studyLinks = async () => (await graphql(page, 'query ($id: ID!) { programsStudy(id: $id) { result { design { id } licence { id } } } }', { id: STUDY })).result
const unitOf = async () => (await graphql(page, 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { name germplasm { id } parents { id } positions { location { id } } } } }', { ids: [UNIT] })).result[0]
const entryOf = async () => (await graphql(page, 'query ($ids: [ID!]) { germplasmEntries(ids: $ids) { result { name origin { id } } } }', { ids: [ENTRY] })).result[0]

async function update(mutation, argument, input, value) {
  const payload = await graphql(page, `mutation ($v: ${input}!) { ${mutation}(${argument}: $v) { status errors { message } } }`, { v: value })
  assert.equal(payload.status, 'SUCCESS', `${mutation}: ${q(payload.errors)}`)
}
const updateStudy = (value) => update('programsUpdateStudy', 'study', 'StudyUpdate', { id: STUDY, ...value })
const updateUnit = (value) => update('unitsUpdateUnit', 'unit', 'UnitUpdate', { id: UNIT, ...value })
const updateEntry = (value) => update('germplasmUpdateEntry', 'entry', 'GermplasmUpdate', { id: ENTRY, ...value })

let browser, page, original
before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  const study = await studyLinks()
  original = {
    study: { designId: study.design?.id ?? null, licenceId: study.licence?.id ?? null },
    germplasmId: (await unitOf()).germplasm?.id ?? null,
    originId: (await entryOf()).origin?.id ?? null
  }
})
after(async () => {
  try {
    if (original) {
      await updateStudy(original.study)
      await updateUnit({ germplasmId: original.germplasmId })
      await updateEntry({ originId: original.originId })
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

// a published design, or else the one this test creates and the admin commits, signed in as the admin meanwhile
async function aDesign() {
  const designs = async (view) => (await graphql(page, `query { ontologyEntries(labels: [DESIGN], view: ${view}) { result { ... on Design { id name } } } }`)).result
  const published = await designs('PUBLISHED')
  if (published.length) return published[0]
  await logout(page)
  await loginAs(page, 'admin')
  try {
    if (!(await designs('EDITORIAL')).some((d) => d.name === DESIGN)) {
      const payload = await graphql(page, 'mutation ($d: DesignInput!) { ontologyCreateDesign(design: $d) { status errors { message } } }', { d: { name: DESIGN } })
      assert.equal(payload.status, 'SUCCESS', q(payload.errors))
    }
    const payload = await graphql(page, 'mutation { ontologyCommitVersion(versionChange: PATCH, comment: "E2E: a design for the optional links test") { status errors { message } } }')
    assert.equal(payload.status, 'SUCCESS', q(payload.errors))
  } finally {
    await logout(page)
    await loginAs(page, 'writer')
  }
  return (await designs('PUBLISHED')).find((d) => d.name === DESIGN)
}

const fieldValue = (card, label) => page.evaluate(`[...document.querySelectorAll(${q(`${card} .fields-grid .field`)})]
  .find((f) => f.querySelector('.field-label').textContent.trim() === ${q(label)})?.querySelector('.field-value').textContent.trim() ?? null`)

async function submitModal() {
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal')`, 30000)
  await page.sleep(1000)
}

test('study: Edit removes its design with "None" and its licence with Remove', async () => {
  const design = await aDesign()
  assert.ok(design, 'a design to set')
  // the study and its datasets are released to registered users, so its licence must be at least (breedgraph e3da216)
  await updateStudy({ designId: design.id, licenceId: String(e.reference_registered.id) })

  const programCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(r.program.name)})`
  const studyCard = `${programCard}.querySelector('.study-card')`
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`${programCard}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.trials-header').click()`)
  await page.waitFor(`${programCard}.querySelector('.trial-card .studies-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.studies-header').click()`)
  await page.waitFor(`${studyCard}?.querySelector('.licence-display') && ${studyCard}.querySelector('.study-actions')`, 30000)
  const mark = page.mark()
  assert.match(await page.evaluate(`${studyCard}.querySelector('.study-content').innerText`), new RegExp(`Design: ${design.name}`))

  await page.evaluate(`${studyCard}.querySelector('.study-actions button').click()`)
  await page.waitFor(`document.querySelector('.modal select[name=designId]')`)
  await page.sleep(500)
  assert.equal(await page.evaluate(`document.querySelector('.modal select[name=designId]').value`), design.id, 'the form shows the design')
  await page.type('.modal select[name=designId]', '')
  await page.evaluate(`document.querySelector('.modal .selected-item .btn-danger-link').click()`)
  await page.sleep(200)
  assert.ok(await page.exists('.modal .reference-section .btn-outline'), 'the licence is replaced by "+ Select Licence"')
  await submitModal()

  assert.deepEqual(await studyLinks(), { design: null, licence: null }, 'both links are removed')
  const content = await page.evaluate(`${studyCard}.querySelector('.study-content').innerText`)
  assert.ok(!/Design:/.test(content) && !(await page.evaluate(`!!${studyCard}.querySelector('.licence-display')`)), `the card shows neither: ${content}`)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('unit: Edit removes its germplasm with the clear button', async () => {
  const unit = await unitOf()
  assert.deepEqual(unit.parents, [], `${unit.name} is a root unit, listed as a unit graph`)
  await updateUnit({ germplasmId: ENTRY })
  const card = '.location-units-panel .details-card'
  await page.goto(`${config.appUrl}/units?location=${unit.positions[0].location.id}`)
  const block = `[...document.querySelectorAll('.block-item')].find((b) => b.querySelector('.block-name').innerText.trim() === ${q(unit.name)})`
  await page.waitFor(block, 30000)
  await page.evaluate(`${block}.click()`)
  await page.waitFor(`document.querySelector('${card} h2')?.innerText.trim() === ${q(unit.name)}`, 30000)
  await page.waitFor(`[...document.querySelectorAll('${card} .card-actions button')].some((b) => b.innerText.includes('Edit'))`, 30000)
  const mark = page.mark()
  assert.equal(await fieldValue(card, 'Germplasm'), e.crop_middle.name)

  await page.evaluate(`[...document.querySelectorAll('${card} .card-actions button')].find((b) => b.innerText.includes('Edit')).click()`)
  await page.waitFor(`document.querySelector('.modal .clear-button')`, 30000)
  await page.click('.modal .clear-button')
  await page.sleep(300)
  assert.equal(await page.exists('.modal .clear-button'), false, 'nothing is left to clear')
  await submitModal()

  assert.equal((await unitOf()).germplasm, null, 'the germplasm is removed')
  assert.equal(await fieldValue(card, 'Germplasm'), null, 'the card shows none')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('germplasm: Edit removes its origin with the clear button', async () => {
  await updateEntry({ originId: String(e.field.id) })
  const card = '.details-card-container'
  await page.goto(`${config.appUrl}/germplasm`)
  const node = `[...document.querySelectorAll('main svg circle')].find((c) => String(c.__data__?.id) === ${q(ENTRY)})`
  await page.waitFor(node, 30000)
  await page.sleep(1000)
  await page.evaluate(`${node}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await page.waitFor(`document.querySelector('${card} .fields-grid')`, 30000)
  await page.waitFor(`[...document.querySelectorAll('${card} button')].some((b) => b.innerText.includes('Edit'))`, 30000)
  const mark = page.mark()
  assert.equal(await fieldValue(card, 'Origin'), e.field.name)

  await page.evaluate(`[...document.querySelectorAll('${card} button')].find((b) => b.innerText.includes('Edit')).click()`)
  await page.waitFor(`document.querySelector('.modal .clear-button')`, 30000)
  await page.click('.modal .clear-button')
  await page.sleep(300)
  await submitModal()

  assert.equal((await entryOf()).origin, null, 'the origin is removed')
  assert.equal(await fieldValue(card, 'Origin'), null, 'the card shows none')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
