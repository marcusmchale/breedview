// A germplasm entry can name the unit it came from (breedgraph, 2026-10-21): chosen in the entry's form (opening
// locations down to their unit graphs), shown on the germplasm card and linked to the Units page, which opens the unit
// where it is now; a viewer who can't read the unit sees it as access restricted, without a link.
// Signed in as the writer, who curates the child team's registered crop_line and reads the units of field; the entry's
// unit is put back afterwards, and an entry the test creates is deleted.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

const q = JSON.stringify
const ENTRY = String(e.crop_line.id)
// a registered tree in the private field_unit at field, and a private leaf the outsider can't read
const UNIT = e.tree_registered
const HIDDEN_UNIT = e.leaf_private

const entryUnit = async () => (await graphql(page, 'query ($ids: [ID!]) { germplasmEntries(ids: $ids) { result { unit { id name } } } }', { ids: [ENTRY] })).result[0].unit
async function setEntryUnit(unitId) {
  const payload = await graphql(page, 'mutation ($entry: GermplasmUpdate!) { germplasmUpdateEntry(entry: $entry) { status errors { message } } }', { entry: { id: ENTRY, unitId } })
  assert.equal(payload.status, 'SUCCESS', q(payload.errors))
}

let browser, page, original
before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  original = (await entryUnit())?.id ?? null
})
after(async () => {
  try {
    if (original !== undefined) await setEntryUnit(original)
  } finally {
    await logout(page); await browser?.close()
  }
})

const card = '.details-card-container'
const fieldValueOf = (label) => `([...document.querySelectorAll(${q(`${card} .fields-grid .field`)})]
  .find((f) => f.querySelector('.field-label').textContent.trim() === ${q(label)})?.querySelector('.field-value').textContent.trim() ?? null)`
const fieldValue = (label) => page.evaluate(fieldValueOf(label))
// the card shows an entry again once it is read again after an edit
const cardShows = (label, value) => page.waitFor(`${fieldValueOf(label)} === ${q(value)}`, 15000)

async function openEntry() {
  await page.goto(`${config.appUrl}/germplasm`)
  const node = `[...document.querySelectorAll('main svg circle')].find((c) => String(c.__data__?.id) === ${q(ENTRY)})`
  await page.waitFor(node, 30000)
  await page.sleep(1000)
  await page.evaluate(`${node}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await page.waitFor(`document.querySelector('${card} .fields-grid')`, 30000)
}

async function openEditForm() {
  await page.waitFor(`[...document.querySelectorAll('${card} button')].some((b) => b.innerText.includes('Edit'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('${card} button')].find((b) => b.innerText.includes('Edit')).click()`)
  await page.waitFor(unitSelect, 30000)
}

const unitSelect = `[...document.querySelectorAll('.modal .formkit-outer')]
  .find((o) => o.querySelector('.formkit-label')?.textContent.trim() === 'Unit (optional):')?.querySelector('.hierarchical-select')`
const selected = () => page.evaluate(`${unitSelect}.querySelector('.selected-value')?.textContent.trim() ?? null`)
// the path to the unit: its location's, then its unit graph's
const pathTo = (unit) => [e.country.name, e.state.name, e.field.name, e.field_unit.name, unit.name]

// opens the unit select and picks the node at the end of a path of labels, going into the nodes before it
async function choose(path) {
  await page.evaluate(`${unitSelect}.querySelector('.select-trigger').click()`)
  const option = (label) => `[...document.querySelectorAll('.dropdown-panel .option-item')].find((o) => o.querySelector('.option-label')?.textContent.trim() === ${q(label)})`
  for (const [step, label] of path.entries()) {
    await page.waitFor(`!document.querySelector('.dropdown-panel .loading-state') && ${option(label)}`, 30000)
    const button = step < path.length - 1 ? '.expand-button' : '.option-label-button'
    await page.evaluate(`${option(label)}.querySelector(${q(button)}).click()`)
    await page.sleep(300)
  }
}

async function submitModal() {
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal')`, 30000)
  await page.sleep(1000)
}

test('writer: Edit chooses the unit it came from, and the card links to it on the Units page', async () => {
  await setEntryUnit(null)
  await openEntry()
  const mark = page.mark()
  assert.equal(await fieldValue('Unit'), null, 'no unit to begin with')

  await openEditForm()
  await choose(pathTo(UNIT))
  assert.equal(await selected(), UNIT.name)
  await submitModal()

  assert.equal((await entryUnit())?.id, String(UNIT.id), 'the entry came from the unit')
  await cardShows('Unit', UNIT.name)
  const link = `document.querySelector(${q(`${card} .field-value a[href$="/units?unit=${UNIT.id}"]`)})`
  assert.ok(await page.evaluate(`!!${link}`), 'linked to the Units page')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')

  // the Units page opens it where it is now: in the unit graph of field
  await page.evaluate(`${link}.click()`)
  await page.waitFor(`location.search.includes('location=${e.field.id}') && location.search.includes('unit=${UNIT.id}')`, 30000)
  await page.waitFor(`document.querySelector('.location-units-panel .details-card h2')?.innerText.trim() === ${q(UNIT.name)}`, 30000)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors on the Units page')
})

test('writer: Edit shows the unit, and removes it with the clear button', async () => {
  await setEntryUnit(String(UNIT.id))
  await openEntry()
  const mark = page.mark()
  await openEditForm()
  await page.waitFor(`${unitSelect}.querySelector('.selected-value')?.textContent.trim() === ${q(UNIT.name)}`, 30000)

  await page.evaluate(`${unitSelect}.querySelector('.clear-button').click()`)
  await page.sleep(300)
  assert.equal(await selected(), null, 'nothing is left to clear')
  await submitModal()

  assert.equal(await entryUnit(), null, 'the unit is removed')
  await cardShows('Unit', null)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('writer: Create gives a new entry the unit it came from', async () => {
  const name = uniqueName('E2E selection ')
  const created = async () => (await graphql(page, 'query { germplasmEntries { result { id name unit { id } } } }')).result
    .find((entry) => entry.name === name)
  try {
    await page.goto(`${config.appUrl}/germplasm`)
    const create = `[...document.querySelectorAll('button')].find((b) => b.innerText.includes('Create New Entry'))`
    await page.waitFor(create, 30000)
    const mark = page.mark()
    await page.evaluate(`${create}.click()`)
    await page.waitFor(unitSelect, 30000)
    await page.type('.modal input[name=name]', name)
    await choose(pathTo(UNIT))
    // the control team defaults to the writer's
    await page.waitFor(`document.querySelector('.modal .control-selector select')?.value`, 30000)
    await submitModal()
    assert.equal((await created())?.unit?.id, String(UNIT.id), 'the new entry came from the unit')
    assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  } finally {
    const entry = await created()
    if (entry) {
      const payload = await graphql(page, 'mutation ($id: ID!) { germplasmDeleteEntry(id: $id) { status errors { message } } }', { id: entry.id })
      assert.equal(payload.status, 'SUCCESS', q(payload.errors))
    }
  }
})

test('outsider: a unit hidden from them shows as access restricted, without a link', async () => {
  await setEntryUnit(String(HIDDEN_UNIT.id))
  await logout(page)
  await loginAs(page, 'outsider')
  try {
    await openEntry()
    const mark = page.mark()
    assert.equal(await fieldValue('Unit'), `Unit ${HIDDEN_UNIT.id} (access restricted)`)
    assert.equal(await page.exists(`${card} .field-value a`), false, 'no link')
    assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  } finally {
    await logout(page)
    await loginAs(page, 'writer')
  }
})
