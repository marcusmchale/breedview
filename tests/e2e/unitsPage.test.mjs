// The Units page on the test database's arrivals (manifest `arrivals`; breedgraph
// tests/breedgraph/scenarios/arrival_scenario.py draws them): a location's arrivals as each viewer sees them, newest
// first; a tree's samples now elsewhere as links from its field to the arrivals that have them; a sample taken at the
// lab listed below its sample, the samples that moved on or were used up marked so, the tree that visited the lab
// marked back at its field; the hidden sample's extract listed in its place for whoever can't read the sample; the
// Locations page's link to a location's units; and a child added with its parent staying in its parent's tree.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { arrivals as a, entities as e } from './lib/fixture.mjs'

const skip = a ? false : 'the test database manifest has no arrivals: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const LAB = a && String(a.locations.lab.id)
const FIELD = a && String(a.locations.field_registered.id)
const unitId = (name) => String(a.units[name])

let browser, page, viewer = null, addedChild = null
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page })
after(async () => {
  try {
    if (addedChild) {
      await signInAs('writer')
      await graphql(page, 'mutation ($id: ID!) { unitsDeleteUnit(id: $id) { status } }', { id: addedChild })
    }
    if (viewer) await logout(page)
  } finally {
    await browser?.close()
  }
})

async function signInAs(next) {
  if (viewer === next) return
  if (viewer) await logout(page)
  await loginAs(page, next)
  viewer = next
}

const arrivalItems = () => page.evaluate(`[...document.querySelectorAll('.arrival-item')].map((item) => ({
  start: item.querySelector('.arrival-start').innerText.trim(), meta: item.querySelector('.arrival-meta').innerText.trim()
}))`)
// the arrival's own units, the tops of its trees
const arrivalUnits = () => page.evaluate(`[...document.querySelectorAll('.arrival-tree > .arrival-unit > .tree-node > div > .node-header .node-name')].map((n) => n.innerText.trim())`)
const startLabel = (start) => (start ? `Arrived ${start}` : 'Undated')
const nodeHeader = (name) => `[...document.querySelectorAll('.node-header')].find((h) => h.querySelector('.node-name').innerText.trim() === ${q(name)})`

async function openArrival(start) {
  await page.waitFor(`[...document.querySelectorAll('.arrival-item .arrival-start')].some((s) => s.innerText.trim() === ${q(startLabel(start))})`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.arrival-item')].find((i) => i.querySelector('.arrival-start').innerText.trim() === ${q(startLabel(start))}).click()`)
  await page.waitFor(`document.querySelector('.arrival-tree .node-name') && !document.querySelector('.arrival-tree > .loading')`, 30000)
  await page.sleep(500)
}

async function expand(name) {
  await page.waitFor(`${nodeHeader(name)}?.querySelector('.expand-btn')`, 30000)
  await page.evaluate(`${nodeHeader(name)}.querySelector('.expand-btn:not(.expanded)')?.click()`)
  await page.waitFor(`!${nodeHeader(name)}.parentElement.querySelector('.children > .loading')`, 30000)
  await page.sleep(500)
}

for (const who of ['writer', 'outsider']) {
  test(`the lab's arrivals, newest first, as the ${who} sees them`, { skip }, async () => {
    await signInAs(who)
    const expected = a.expected.arrivals.lab[who]
    await page.goto(`${config.appUrl}/units?location=${LAB}`)
    await page.waitFor(`document.querySelectorAll('.arrival-item').length === ${expected.length}`, 30000)
    const items = await arrivalItems()
    assert.deepEqual(items.map((i) => i.start), expected.map((arrival) => startLabel(arrival.start)))
    for (const [index, arrival] of expected.entries()) {
      assert.match(items[index].meta, new RegExp(`^${arrival.units.length} units? · from `), items[index].meta)
    }
    const recent = expected.find((arrival) => arrival.start === '2025-03-25')
    await openArrival('2025-03-25')
    assert.deepEqual(await arrivalUnits(), recent.units)
  })
}

test('a tree\'s samples elsewhere are links from its field to the arrivals that have them', { skip }, async () => {
  await signInAs('writer')
  await page.goto(`${config.appUrl}/units?location=${FIELD}&graph=${unitId('Arrival Field')}`)
  await expand('Arrival Field')
  await expand('Arrival Plot')
  await expand('Arrival Tree A')
  const links = await page.evaluate(`[...${nodeHeader('Arrival Tree A')}.parentElement.querySelectorAll(':scope > .children > .away-link')].map((l) => l.innerText.trim())`)
  // six at the lab (one used up there), and one there before it moved on to the lab store; none are listed below the
  // tree
  assert.deepEqual(links.sort(), [`↗ 1 at ${a.locations.lab_store.name}`, `↗ 6 at ${e.lab.name}`].sort())
  assert.equal(await page.evaluate(`!!${nodeHeader('Arrival Sample A1')}`), false, 'the samples are not listed at the field')
  await page.evaluate(`[...document.querySelectorAll('.away-link')].find((l) => l.innerText.includes(${q(e.lab.name)})).click()`)
  await page.waitFor(`location.search.includes('location=${LAB}') && document.querySelector('.arrival-item.selected')`, 30000)
  await page.waitFor(`document.querySelector('.arrival-tree .from-chip')`, 30000)
  await page.sleep(1000)
  assert.deepEqual((await arrivalItems()).map((i) => i.start), ['Arrived 2025-03-25', 'Arrived 2024-11', 'Undated'], 'the arrivals of Tree A\'s units')
  assert.deepEqual(await arrivalUnits(), ['Arrival Pooled', 'Arrival Sample A1', 'Arrival Sample A2', 'Arrival Sample A3', 'Arrival Sample Hidden'])
})

test('a sample taken at the lab is below its sample; moved on, used up and back at its field are marked', { skip }, async () => {
  await signInAs('writer')
  await page.goto(`${config.appUrl}/units?location=${LAB}`)
  await openArrival('2025-03-25')
  await expand('Arrival Sample A1')
  assert.ok(await page.evaluate(`!!${nodeHeader('Arrival Extract A1')}`), 'the extract taken at the lab is listed below its sample')
  const badge = (name, selector) => page.evaluate(`${nodeHeader(name)}?.querySelector(${q(selector)})?.innerText.trim() ?? null`)
  assert.equal(await badge('Arrival Sample A2', '.place-badge'), `now at ${a.locations.lab_store.name}`)
  assert.equal(await badge('Arrival Sample A3', '.ended-badge'), 'until 2025-04-15')
  await openArrival('2024-06')
  assert.deepEqual(await arrivalUnits(), ['Arrival Tree B'])
  assert.equal(await badge('Arrival Tree B', '.place-badge'), `now at ${e.field_registered.name}`)
})

test('the outsider sees the hidden sample\'s extract as the arrival, in its place', { skip }, async () => {
  await signInAs('outsider')
  await page.goto(`${config.appUrl}/units?location=${LAB}`)
  await openArrival('2025-03-25')
  const units = await arrivalUnits()
  assert.ok(units.includes('Arrival Extract Hidden') && !units.includes('Arrival Sample Hidden'), `${units}`)
})

test('the Locations page links to the units at a location', { skip }, async () => {
  await signInAs('writer')
  await page.goto(`${config.appUrl}/locations?location=${LAB}`)
  const expected = a.expected.arrivals.lab.writer.length
  await page.waitFor(`document.querySelector('.units-link')?.innerText.includes('${expected} arrivals')`, 30000)
  await page.click('.units-link')
  await page.waitFor(`location.pathname === '/units' && location.search.includes('location=${LAB}') && document.querySelector('.arrival-item')`, 30000)
})

test('a child added with its parent is listed below it, where its parent is', { skip }, async () => {
  await signInAs('writer')
  await page.goto(`${config.appUrl}/units?location=${FIELD}&unit=${unitId('Arrival Move Tree')}`)
  await page.waitFor(`document.querySelector('.details-card h2')?.innerText.trim() === 'Arrival Move Tree'`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.details-card .card-actions button')].find((b) => b.innerText.includes('Add Child')).click()`)
  await page.waitFor(`document.querySelector('.modal select[name=subjectId]')`, 30000)
  const name = `E2E child ${Date.now().toString(36)}`
  // "With its parent" is the default: no location is asked for
  assert.ok(await page.evaluate(`document.querySelector('.modal input[type=radio][value=parent]')?.checked`), 'with its parent')
  assert.ok(!(await page.evaluate(`document.querySelector('.modal').innerText.includes('Location:')`)), 'no location asked for')
  await page.evaluate(`(() => {
    const select = document.querySelector('.modal select[name=subjectId]')
    select.value = [...select.options].find((o) => o.text === 'Sample').value
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
    const input = document.querySelector('.modal input[name=name]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(name)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await page.sleep(300)
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal')`, 30000)
  const created = (await graphql(page, 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { children { id name } } } }', { ids: [unitId('Arrival Move Tree')] }))
    .result[0].children.find((child) => child.name === name)
  assert.ok(created, 'the child was created')
  addedChild = created.id
  const positions = (await graphql(page, 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { positions { start } } } }', { ids: [created.id] })).result[0].positions
  assert.deepEqual(positions, [], 'with its parent, it has no position of its own')
  await expand('Arrival Move Tree')
  assert.ok(await page.evaluate(`!!${nodeHeader(name)}`), 'it is listed below its parent at the field')
})
