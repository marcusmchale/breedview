// The dataset submission's units picker offers the arrivals at the chosen locations, and at the places within them,
// beside their unit graphs (manifest `arrivals`; skipped without them), a level for each place when there are several:
// at the lab, where no unit graph is rooted, its arrivals and those of its store are listed under each place; ticking
// one selects the units that came, opening it lists them, and "By type…" in it groups them by subject. Choosing the
// country lists every place below it with units. Signed in as the writer, who curates the arrivals study.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'
import { arrivals as a, entities as e } from './lib/fixture.mjs'

const skip = a ? false : 'the test database manifest has no arrivals: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify

let browser, page
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'writer') })
after(async () => { await logout(page); await browser?.close() })

const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-item .option-label')].map((o) => o.innerText.trim())`)
const optionIndex = (label) => `[...document.querySelectorAll('.options-list .option-item')].findIndex((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`

// opens a closed expansion header (they toggle) in the card
const openHeader = (card, header) => page.evaluate(`(() => {
  const h = ${card}.querySelector(${q(header)})
  if (h.querySelector('.expand-icon').innerText.includes('►')) h.click()
})()`)

async function openSubmission() {
  await page.goto(`${config.appUrl}/programs`)
  const program = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(a.program.name)})`
  await page.waitFor(`${program}?.querySelector('.trials-header')`, 30000)
  await openHeader(program, '.trials-header')
  const trial = `[...${program}.querySelectorAll('.trial-card')].find((c) => c.innerText.includes(${q(a.trial.name)}))`
  await page.waitFor(`${trial}?.querySelector('.studies-header')`, 30000)
  await openHeader(trial, '.studies-header')
  const card = `[...${trial}.querySelectorAll('.study-card')].find((c) => c.innerText.includes(${q(a.study.name)}))`
  await page.waitFor(`${card}?.querySelector('.section-toggle')`, 30000)
  await page.evaluate(`[...${card}.querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click()`)
  await page.waitFor(`[...${card}.querySelectorAll('button')].some((b) => b.innerText.includes('Create New Dataset'))`, 30000)
  await page.evaluate(`[...${card}.querySelectorAll('button')].find((b) => b.innerText.includes('Create New Dataset')).click()`)
  await page.waitFor(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger').length >= 2`, 30000)
  await page.sleep(1000)
}

async function pickLocation(path, target) {
  await page.evaluate(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger')[0].click()`)
  await page.waitFor(levelLoaded, 30000)
  for (const name of path) {
    if ((await page.evaluate(optionIndex(target))) >= 0) break
    await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(name)}].querySelector('.expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(target)}].querySelector('.option-checkbox').click()`)
  await page.sleep(300)
  await page.click('.btn-done')
  await page.sleep(1500)
}

test('at the lab, the units picker offers its arrivals, and an arrival\'s tick selects the units that came', { skip }, async () => {
  await openSubmission()
  await pickLocation([e.country.name, e.state.name, e.field.name], e.lab.name)
  await page.evaluate(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger')[1].click()`)
  await page.waitFor(levelLoaded, 30000)
  // the lab holds its store, so a level for each place first
  const store = a.locations.lab_store.name
  assert.deepEqual(await optionLabels(), [e.lab.name, store].sort((x, y) => x.localeCompare(y)), 'the lab and its store')
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(e.lab.name)}].querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 30000)
  const expected = a.expected.arrivals.lab.writer
  const labels = await optionLabels()
  assert.deepEqual(labels, expected.map((arrival) => `${arrival.start ? `Arrived ${arrival.start}` : 'Undated arrival'} at ${e.lab.name}`),
    'no unit graph is rooted at the lab: only its arrivals')
  const recent = expected.find((arrival) => arrival.start === '2025-03-25')
  const label = `Arrived 2025-03-25 at ${e.lab.name}`
  // its tick waits for what lies below it: the arrival's units, answered from the arrival
  await page.waitFor(`!document.querySelectorAll('.options-list .option-item')[${optionIndex(label)}].querySelector('.option-checkbox').disabled`, 30000)
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(label)}].querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.includes('${recent.units.length} selected')`, 30000)
  // opening it lists the units that came
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(label)}].querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 30000)
  assert.deepEqual(await optionLabels(), recent.units)
  assert.ok(await page.evaluate(`[...document.querySelectorAll('.options-list .option-checkbox')].every((c) => c.checked)`), 'they are all selected')
  await page.click('.btn-done')
})

test('choosing the country lists every place below it with units, each opening to its unit graphs and arrivals', { skip }, async () => {
  await openSubmission()
  await pickLocation([], e.country.name)
  await page.evaluate(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger')[1].click()`)
  await page.waitFor(levelLoaded, 30000)
  const places = await optionLabels()
  for (const place of [e.field.name, e.lab.name, a.locations.lab_store.name]) {
    assert.ok(places.includes(place), `${place} is among the places: ${places.join(', ')}`)
  }
  assert.deepEqual(places, [...places].sort((x, y) => x.localeCompare(y)), 'by name')
  // the store's tick selects what came there: its one arrival's units
  const store = a.locations.lab_store.name
  const [arrival] = a.expected.arrivals.lab_store.writer
  await page.waitFor(`!document.querySelectorAll('.options-list .option-item')[${optionIndex(store)}].querySelector('.option-checkbox').disabled`, 30000)
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(store)}].querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.includes('${arrival.units.length} selected')`, 30000)
  // opening the field lists the unit graphs rooted there
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex(e.field.name)}].querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 30000)
  assert.ok((await optionLabels()).includes(e.field_unit.name), 'the field unit graph is rooted at the field')
  await page.click('.btn-done')
})
