// Units derived from an arrival's on the Units page, on the test database's arrivals (manifest `arrivals`; skipped
// without them): signed in as the stranger, who reads the lab's arrivals but writes only to its own team, Arrival
// Sample Own (at the lab from 2024-11, germplasm crop_line of its own) is derived from as a unit graph of the stranger's.
// The new unit takes the sample's name and germplasm, and its card says what it came from; the sample's lists it among
// its derivatives and stays where it was, and its arrival is settled. The derivation is then removed from the new
// unit's card. The units derived are deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { arrivals as a, entities as e } from './lib/fixture.mjs'

const skip = a ? false : 'the test database manifest has no arrivals: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const LAB = a && String(a.locations.lab.id)
const SAMPLE = a && String(a.units['Arrival Sample Own'])

const DERIVATIONS = 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { id positions { location { id } start end } derivedFrom { unit { id } sourceType description } derivatives { unit { id } } } } }'

let browser, page, derivedId = null
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'stranger') })
after(async () => {
  try {
    if (a) {
      // the units derived from the sample, and the one derived here if its link was removed
      const { result } = await graphql(page, DERIVATIONS, { ids: [SAMPLE] })
      const ids = new Set([...(result[0]?.derivatives ?? []).map((derivation) => derivation.unit.id), derivedId].filter(Boolean))
      for (const id of ids) {
        await graphql(page, 'mutation ($id: ID!) { unitsDeleteUnit(id: $id) { status } }', { id })
      }
    }
    await logout(page)
  } finally {
    await browser?.close()
  }
})

// a field of the open modal, by name: an input, or a select
async function fill(name, value) {
  await page.evaluate(`(() => {
    const field = document.querySelector('.modal-overlay [name=${name}]')
    const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${q(value)})
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
}

const cardTags = (section) => page.evaluate(`[...document.querySelectorAll('.details-card .${section} .tag')].map((t) => t.innerText.trim())`)

test('an arrival\'s sample derived from as a unit graph of the stranger\'s', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${LAB}&arrival=2024-11`)
  await page.waitFor(`document.querySelector('.arrival-tree .node-name') && !document.querySelector('.arrival-tree > .loading')`, 30000)
  // the stranger curates none of the lab's units, so may only derive from them
  await page.waitFor(`[...document.querySelectorAll('.arrival-actions button')].map((b) => b.innerText.trim()).join() === 'Derive…'`, 30000)
  await page.evaluate(`document.querySelector('.arrival-actions button').click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .modal') && document.querySelector('.modal-overlay select[name=sourceType]')`, 30000)
  // the team to write the new unit in is chosen once the user's teams are read
  await page.waitFor(`document.querySelector('.modal-overlay .control-selector select')?.value`, 30000)
  await page.sleep(500)
  await fill('sourceType', 'TISSUE')
  await fill('description', 'Micropropagation')
  await page.click('.modal-overlay button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal-overlay') || document.querySelector('.modal-overlay .error-message')`, 30000)
  const error = await page.evaluate(`document.querySelector('.modal-overlay .error-message')?.innerText ?? null`)
  assert.equal(error, null, error)
  await page.waitFor(`document.querySelector('.notice')?.innerText.includes('Derived 1 unit at ${e.lab.name}')`, 30000)

  // the sample stays where it was, and its arrival is settled: shown, as it is the one open, with what was derived
  const { result } = await graphql(page, DERIVATIONS, { ids: [SAMPLE] })
  const [sample] = result
  assert.deepEqual(sample.positions.map((p) => [p.location.id, p.start, p.end]), [[LAB, '2024-11', null]])
  assert.equal(sample.derivatives.length, 1)
  derivedId = sample.derivatives[0].unit.id
  await page.waitFor(`[...document.querySelectorAll('.arrival-item.selected.settled .arrival-meta')].some((m) => m.innerText.includes('1 derived from'))`, 30000)

  // the new unit, at the lab as a unit graph of its own, takes the sample's name and germplasm
  await page.evaluate(`document.querySelector('.notice a').click()`)
  await page.waitFor(`location.search.includes('unit=${derivedId}') && document.querySelector('.details-card .derived-from .tag')`, 30000)
  assert.equal(await page.evaluate(`document.querySelector('.details-card h2').innerText.trim()`), 'Arrival Sample Own')
  assert.deepEqual(await cardTags('derived-from'), ['Arrival Sample Own (Tissue: Micropropagation)'])
  const germplasm = await page.evaluate(`[...document.querySelectorAll('.details-card .field')].find((f) => f.querySelector('.field-label').innerText.trim().toUpperCase() === 'GERMPLASM')?.querySelector('.field-value').innerText.trim() ?? null`)
  assert.equal(germplasm, e.crop_line.name, 'its own germplasm, copied from the sample')

  // the sample's card lists it among its derivatives
  await page.goto(`${config.appUrl}/units?location=${LAB}&unit=${SAMPLE}`)
  await page.waitFor(`document.querySelector('.details-card .derivatives .tag')`, 30000)
  assert.deepEqual(await cardTags('derivatives'), ['Arrival Sample Own (Tissue: Micropropagation)'])
})

test('the derivation removed from the new unit\'s card', { skip }, async () => {
  assert.ok(derivedId, 'a unit was derived')
  await page.goto(`${config.appUrl}/units?location=${LAB}&unit=${derivedId}`)
  await page.waitFor(`document.querySelector('.details-card .derived-from .tag')`, 30000)
  await page.waitFor(`[...document.querySelectorAll('.details-card .card-actions button')].some((b) => b.innerText.includes('Derived from'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.details-card .card-actions button')].find((b) => b.innerText.includes('Derived from')).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .derivation-row')`, 30000)
  await page.evaluate(`document.querySelector('.modal-overlay .derivation-row .btn-remove').click()`)
  await page.waitFor(`!document.querySelector('.modal-overlay .derivation-row')`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.modal-overlay .form-actions button')].find((b) => b.innerText.includes('Save')).click()`)
  await page.waitFor(`!document.querySelector('.modal-overlay') || document.querySelector('.modal-overlay .error-message')`, 30000)
  const error = await page.evaluate(`document.querySelector('.modal-overlay .error-message')?.innerText ?? null`)
  assert.equal(error, null, error)
  await page.waitFor(`!document.querySelector('.details-card .derived-from')`, 30000)
  const { result } = await graphql(page, DERIVATIONS, { ids: [derivedId, SAMPLE] })
  assert.deepEqual(result.map((unit) => [unit.id, unit.derivedFrom.length, unit.derivatives.length]), [[derivedId, 0, 0], [SAMPLE, 0, 0]])
})
