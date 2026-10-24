// Moving units on the Units page, on the test database's spare arrival (manifest `arrivals`; skipped without them):
// Arrival Move Sample 1 and 2, at the lab from 2025-06-10, signed in as the writer, who curates them. The arrival moved
// on to the lab store, where it then is; ended there; its start corrected, the page following it; and a unit received
// back at the lab from the store. Their positions are put back as they were afterwards. Then, changing nothing, the
// pickers that list the places below a location: receiving at the lab from the field above it, and a sample's Derived
// from… there.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { arrivals as a, entities as e } from './lib/fixture.mjs'

const skip = a ? false : 'the test database manifest has no arrivals: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const LAB = a && String(a.locations.lab.id)
const STORE = a && String(a.locations.lab_store.id)
const SAMPLES = a ? ['Arrival Move Sample 1', 'Arrival Move Sample 2'].map((name) => String(a.units[name])) : []
const LAB_PATH = a ? [e.country.name, e.state.name, e.field.name] : []

let browser, page
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'writer') })
after(async () => {
  try {
    if (a) await restore()
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const POSITIONS = 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { id positions { location { id } layout { id } coordinates start end } } } }'

// Back to the lab from 2025-06-10, open-ended: positions written by the tests removed, the lab's end taken off
async function restore() {
  const { result } = await graphql(page, POSITIONS, { ids: SAMPLES })
  for (const unit of result) {
    for (const position of unit.positions) {
      const value = {
        locationId: position.location.id, layoutId: position.layout?.id ?? null,
        coordinates: position.coordinates?.length ? position.coordinates : null, start: position.start, end: position.end
      }
      if (position.location.id === LAB && position.start === '2025-06-10') {
        if (position.end) {
          await graphql(page, 'mutation ($units: UnitsSelection!, $at: PositionMatchInput!, $change: PositionChangeInput!) { unitsChangePositions(units: $units, at: $at, change: $change) { status } }',
            { units: { unitIds: [unit.id] }, at: { locationId: LAB, start: '2025-06-10' }, change: { end: null } })
        }
      } else {
        await graphql(page, 'mutation ($id: ID!, $position: PositionInput!) { unitsRemovePosition(id: $id, position: $position) { status } }',
          { id: unit.id, position: value })
      }
    }
  }
}

const startLabel = (start) => (start ? `Arrived ${start}` : 'Undated')
const option = (label) => `[...document.querySelectorAll('.dropdown-panel .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
const optionLoaded = (label) => `!document.querySelector('.dropdown-panel .loading-state') && ${option(label)}`

async function openArrival(location, start) {
  await page.goto(`${config.appUrl}/units?location=${location}&arrival=${start}`)
  await page.waitFor(`document.querySelector('.arrival-tree .node-name') && !document.querySelector('.arrival-tree > .loading')`, 30000)
  // the actions show once the user is known to curate the units listed (Derive… needs only a team to write in)
  await page.waitFor(`[...document.querySelectorAll('.arrival-actions button')].some((b) => b.innerText.includes('Move on'))`, 30000)
}

async function action(label) {
  await page.evaluate(`[...document.querySelectorAll('.arrival-actions button')].find((b) => b.innerText.includes(${q(label)})).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .modal')`, 30000)
  await page.sleep(500)
}

// a text field of the open modal, by name
async function fill(name, value) {
  await page.evaluate(`(() => {
    const input = document.querySelector('.modal-overlay input[name=${name}]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}

// the first location select of the open modal: down the path, then the location
async function chooseLocation(path, name, select = 0) {
  await page.evaluate(`document.querySelectorAll('.modal-overlay .hierarchical-select .select-trigger')[${select}].click()`)
  for (const step of path) {
    await page.waitFor(optionLoaded(step), 30000)
    await page.evaluate(`${option(step)}.querySelector('.expand-button').click()`)
  }
  await page.waitFor(optionLoaded(name), 30000)
  await page.evaluate(`${option(name)}.querySelector('.option-label-button').click()`)
  await page.sleep(300)
}

async function submit() {
  await page.click('.modal-overlay button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal-overlay') || document.querySelector('.modal-overlay .error-message')`, 30000)
  const error = await page.evaluate(`document.querySelector('.modal-overlay .error-message')?.innerText ?? null`)
  assert.equal(error, null, error)
}

const arrivalStarts = () => page.evaluate(`[...document.querySelectorAll('.arrival-item .arrival-start')].map((s) => s.innerText.trim())`)

test('an arrival moved on to the lab store is there from then', { skip }, async () => {
  await openArrival(LAB, '2025-06-10')
  await action('Move on')
  await chooseLocation([...LAB_PATH, e.lab.name], a.locations.lab_store.name)
  await fill('start', '2025-07-01')
  await submit()
  await page.waitFor(`document.querySelector('.notice')?.innerText.includes('Moved 2 units to ${a.locations.lab_store.name}')`, 30000)
  await page.evaluate(`document.querySelector('.notice a').click()`)
  await page.waitFor(`location.search.includes('location=${STORE}') && document.querySelector('.arrival-item.selected')`, 30000)
  assert.ok((await arrivalStarts()).includes(startLabel('2025-07-01')))
  await page.waitFor(`document.querySelectorAll('.arrival-tree > .arrival-unit').length === 2`, 30000)
  const { result } = await graphql(page, POSITIONS, { ids: SAMPLES })
  for (const unit of result) {
    assert.deepEqual(unit.positions.map((p) => [p.location.id, p.start, p.end]), [[LAB, '2025-06-10', '2025-07-01'], [STORE, '2025-07-01', null]])
  }
})

test('ended at the store, then its start corrected, the page following it', { skip }, async () => {
  await openArrival(STORE, '2025-07-01')
  await action('End here')
  await fill('end', '2025-08-01')
  await submit()
  await page.waitFor(`[...document.querySelectorAll('.arrival-tree .ended-badge')].filter((b) => b.innerText.trim() === 'until 2025-08-01').length === 2`, 30000)
  await openArrival(STORE, '2025-07-01')
  await action('Correct')
  await fill('start', '2025-07-02')
  await submit()
  await page.waitFor(`location.search.includes('arrival=2025-07-02') && document.querySelector('.arrival-heading h5')?.innerText.includes('on 2025-07-02')`, 30000)
  assert.ok((await arrivalStarts()).includes(startLabel('2025-07-02')))
})

test('a unit received back at the lab from the store', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${LAB}`)
  await page.waitFor(`[...document.querySelectorAll('.location-header button')].some((b) => b.innerText.includes('Receive units'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.location-header button')].find((b) => b.innerText.includes('Receive units')).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .modal')`, 30000)
  await page.sleep(500)
  await chooseLocation([...LAB_PATH, e.lab.name], a.locations.lab_store.name)
  // the units picker offers the store's arrivals: open the corrected one and tick the first sample
  await page.evaluate(`document.querySelector('.modal-overlay .hierarchical-multiselect .select-trigger').click()`)
  const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
  const item = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
  await page.waitFor(levelLoaded, 30000)
  const arrival = `Arrived 2025-07-02 at ${a.locations.lab_store.name}`
  await page.waitFor(item(arrival), 30000)
  await page.evaluate(`${item(arrival)}.querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 30000)
  await page.waitFor(item('Arrival Move Sample 1'), 30000)
  await page.evaluate(`${item('Arrival Move Sample 1')}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.includes('1 selected')`, 30000)
  await page.click('.btn-done')
  await page.sleep(500)
  await fill('start', '2025-09-01')
  await submit()
  await page.waitFor(`location.search.includes('arrival=2025-09-01') && document.querySelector('.arrival-tree .node-name')`, 30000)
  const names = await page.evaluate(`[...document.querySelectorAll('.arrival-tree > .arrival-unit > .tree-node > div > .node-header .node-name')].map((n) => n.innerText.trim())`)
  assert.deepEqual(names, ['Arrival Move Sample 1'])
})

// The pickers at a place above the lab, changing nothing: the lab is where received units go, so it can't be where
// they come from, and what is at it is there already; the store within it can be chosen from
const unitsLevelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const unitOptions = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-item')]
  .map((o) => [o.querySelector('.option-label')?.innerText.trim(), o.classList.contains('disabled')])`)

test('received from a place above the lab, the lab\'s own units are already here and its store is offered', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${LAB}`)
  await page.waitFor(`[...document.querySelectorAll('.location-header button')].some((b) => b.innerText.includes('Receive units'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.location-header button')].find((b) => b.innerText.includes('Receive units')).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .modal')`, 30000)
  await page.sleep(500)
  // From: down to the field, where the lab can be opened but not chosen; then back up to choose the field
  await page.evaluate(`document.querySelector('.modal-overlay .hierarchical-select .select-trigger').click()`)
  for (const step of LAB_PATH) {
    await page.waitFor(optionLoaded(step), 30000)
    await page.evaluate(`${option(step)}.querySelector('.expand-button').click()`)
  }
  await page.waitFor(optionLoaded(e.lab.name), 30000)
  assert.ok(await page.evaluate(`${option(e.lab.name)}.classList.contains('not-selectable')`), 'the lab is not where they come from')
  await page.evaluate(`[...document.querySelectorAll('.dropdown-panel .breadcrumb-item')].find((b) => b.innerText.trim() === ${q(e.state.name)}).click()`)
  await page.waitFor(optionLoaded(e.field.name), 30000)
  await page.evaluate(`${option(e.field.name)}.querySelector('.option-label-button').click()`)
  await page.sleep(300)

  await page.evaluate(`document.querySelector('.modal-overlay .hierarchical-multiselect .select-trigger').click()`)
  const here = `${e.lab.name} (already here)`
  await page.waitFor(`${unitsLevelLoaded} && [...document.querySelectorAll('.options-list .option-label')].some((l) => l.innerText.trim() === ${q(here)})`, 30000)
  const places = await unitOptions()
  assert.deepEqual(places.filter(([, disabled]) => disabled).map(([label]) => label), [here], JSON.stringify(places))
  assert.ok(places.some(([label]) => label === a.locations.lab_store.name), `the store is offered: ${JSON.stringify(places)}`)
  await page.click('.btn-done')
  await page.clickText('Cancel')
  await page.waitFor(`!document.querySelector('.modal-overlay')`, 15000)
})

test('what a unit was derived from is offered at a place above the units too', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${LAB}&unit=${SAMPLES[0]}`)
  await page.waitFor(`[...document.querySelectorAll('.details-card .card-actions button')].some((b) => b.innerText.includes('Derived from'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.details-card .card-actions button')].find((b) => b.innerText.includes('Derived from')).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .hierarchical-select .select-trigger')`, 30000)
  await chooseLocation([e.country.name, e.state.name], e.field.name)
  await page.evaluate(`document.querySelector('.modal-overlay .hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(`${unitsLevelLoaded} && [...document.querySelectorAll('.options-list .option-label')].some((l) => l.innerText.trim() === ${q(a.locations.lab_store.name)})`, 30000)
  const places = (await unitOptions()).map(([label]) => label)
  assert.ok(places.includes(e.lab.name) && places.includes(a.locations.lab_store.name), `the lab and its store: ${JSON.stringify(places)}`)
  await page.click('.btn-done')
  await page.clickText('Cancel')
  await page.waitFor(`!document.querySelector('.modal-overlay')`, 15000)
})
