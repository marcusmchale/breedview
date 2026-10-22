// Children added to many units at once on the Units page, on the test database's arrivals (manifest `arrivals`;
// skipped without them), signed in as the writer, who curates them. A leaf for each tree of Arrival Field, picked "By
// type…" below it, taken on one day: each named from its tree and placed where its tree was then. Then two extracts of
// the one sample the lab's arrival is shown from, unnamed by number until the name has {n}, and undated, so with their
// sample. The children added are deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { arrivals as a, manifest } from './lib/fixture.mjs'

const skip = a ? false : 'the test database manifest has no arrivals: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const FIELD = a && String(a.locations.field_registered.id)
const LAB = a && String(a.locations.lab.id)
const TREES = a ? ['Arrival Move Tree', 'Arrival Tree A', 'Arrival Tree B', 'Arrival Tree C'] : []
const SAMPLE = a && String(a.units['Arrival Sample A1'])
const LEAF = manifest.ids.ontology_subject_leaf
const SAMPLE_SUBJECT = manifest.ids.ontology_subject_sample

const CHILDREN = 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { id name children { id name subject { id } positions { location { id } start end } } } } }'

let browser, page
const added = []  // the ids of the children added, to delete them afterwards
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'writer') })
after(async () => {
  try {
    for (const id of added) {
      await graphql(page, 'mutation ($id: ID!) { unitsDeleteUnit(id: $id) { status } }', { id })
    }
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const optionIndex = (label) => `[...document.querySelectorAll('.options-list .option-item')].findIndex((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`

// a field of the open modal, by name: an input, or a select by its option's label
async function fill (name, value) {
  await page.evaluate(`(() => {
    const field = document.querySelector('.modal-overlay [name=${name}]')
    const prototype = field.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${q(value)})
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
}
const selectSubject = (id) => page.evaluate(`(() => {
  const select = document.querySelector('.modal-overlay select[name=subjectId]')
  const option = [...select.options].find((o) => o.value === ${q(String(id))} || o._value === ${q(String(id))})
  select.value = option.value
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
})()`)

async function submit () {
  await page.click('.modal-overlay button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal-overlay') || document.querySelector('.modal-overlay .error-message')`, 30000)
  const error = await page.evaluate(`document.querySelector('.modal-overlay .error-message')?.innerText ?? null`)
  assert.equal(error, null, error)
}

test('a leaf for each tree of a field, picked by type and taken on one day', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${FIELD}&graph=${a.units['Arrival Field']}`)
  await page.waitFor(`[...document.querySelectorAll('.tree-actions button')].some((b) => b.innerText.includes('Add children'))`, 30000)
  await page.clickText('Add children…')
  await page.waitFor(`document.querySelector('.modal-overlay .hierarchical-multiselect .select-trigger')`, 30000)
  await page.waitFor(`document.querySelector('.modal-overlay .control-selector select')?.value`, 30000)
  await page.sleep(500)

  // the trees below Arrival Field, by type
  await page.evaluate(`document.querySelector('.modal-overlay .hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(`${levelLoaded} && ${optionIndex('Arrival Field')} >= 0`, 30000)
  await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${optionIndex('Arrival Field')}].querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 30000)
  await page.click('.select-by-type-button')
  const treeRow = `[...document.querySelectorAll('.type-panel .type-row')].find((r) => r.querySelector('.type-label').innerText.startsWith('Tree'))`
  await page.waitFor(treeRow, 30000)
  await page.evaluate(`[...${treeRow}.querySelectorAll('button')].find((b) => b.innerText.trim() === 'All').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.includes('${TREES.length} selected')`, 30000)
  await page.click('.btn-done')
  await page.sleep(500)

  await selectSubject(LEAF)
  await fill('start', '2025-05-04')
  await page.waitFor(`document.querySelector('.modal-overlay .example')?.innerText.includes(' - Leaf 1')`, 15000)
  await submit()
  await page.waitFor(`document.querySelector('.notice')?.innerText.includes('Added ${TREES.length} children')`, 30000)

  // each tree has its leaf, named from it, where it was that day: the field, as each takes its place from Arrival Field
  const { result } = await graphql(page, CHILDREN, { ids: TREES.map((name) => String(a.units[name])) })
  for (const tree of result) {
    const leaves = tree.children.filter((child) => child.name === `${tree.name} - Leaf 1`)
    assert.equal(leaves.length, 1, tree.name)
    added.push(leaves[0].id)
    assert.equal(leaves[0].subject.id, String(LEAF))
    assert.deepEqual(leaves[0].positions.map((p) => [p.location.id, p.start, p.end]), [[FIELD, '2025-05-04', null]])
  }
})

test('two extracts of an arrival\'s sample, with it, and named by number', { skip }, async () => {
  await page.goto(`${config.appUrl}/units?location=${LAB}&arrival=2025-03-25&from=${SAMPLE}`)
  await page.waitFor(`[...document.querySelectorAll('.arrival-actions button')].some((b) => b.innerText.includes('Add children'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.arrival-actions button')].find((b) => b.innerText.includes('Add children')).click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .modal h4')?.innerText.includes('the units from Arrival Sample A1')`, 30000)
  await page.waitFor(`document.querySelector('.modal-overlay .control-selector select')?.value`, 30000)
  await page.sleep(500)

  await selectSubject(SAMPLE_SUBJECT)
  await fill('count', '2')
  // two of each need {n} to tell them apart
  await fill('name', '{parent} extract')
  await page.waitFor(`document.querySelector('.modal-overlay button[type=submit]').disabled`, 15000)
  await fill('name', '{parent} extract {n}')
  await page.waitFor(`document.querySelector('.modal-overlay .example')?.innerText.includes('Arrival Sample A1 extract 1')`, 15000)
  await fill('start', '')
  await submit()
  await page.waitFor(`document.querySelector('.notice')?.innerText.includes('Added 2 children')`, 30000)

  const { result } = await graphql(page, CHILDREN, { ids: [SAMPLE] })
  const extracts = result[0].children.filter((child) => /^Arrival Sample A1 extract \d$/.test(child.name))
  added.push(...extracts.map((child) => child.id))
  assert.deepEqual(extracts.map((child) => [child.name, child.positions]).sort(), [
    ['Arrival Sample A1 extract 1', []], ['Arrival Sample A1 extract 2', []]
  ])
})
