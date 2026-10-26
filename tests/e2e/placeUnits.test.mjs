// Units placed at once from a table on the Units page (placeUnitsModal, unitsPlaceUnits), on the test database's field
// laid out in blocks (manifest `positions`; skipped without them), signed in as the writer. Three plots are made for
// the test, private to the child team, at Position Field South, and deleted afterwards. Place units… opens on the
// selected unit's children; with the field's layout of blocks chosen, the table takes a Block, Row and Tree for each,
// as each block sits at its number on the field's Block axis. A field sheet pasted on a unit's name fills the rows by
// name, a germplasm no one is named stops the save until corrected, and one plot is left unplaced. Saved, the plots are
// in their blocks from the day given, with their germplasm; opened again, the table shows them as placed.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { entities as e, manifest, positions as p, teams } from './lib/fixture.mjs'

const skip = p ? false : 'the test database manifest has no positions: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const SOUTH = p && String(p.locations['Position Field South'])
const BLOCKS = 'Position South Blocks'
const BLOCK_1 = p && String(p.layouts['Position South Block 1'])
const BLOCK_2 = p && String(p.layouts['Position South Block 2'])
const SOWN = '2026-10-15'

const UNITS = 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { id name germplasm { id } positions { location { id } layout { id } coordinates start end } } } }'

let browser, page, root, plots
before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  if (skip) return
  const name = uniqueName('E2E placed trial ')
  const created = await graphql(page,
    'mutation ($u: UnitInput!, $team: ID!, $p: PositionInput) { unitsCreateUnit(unit: $u, controlTeamId: $team, release: PRIVATE, position: $p) { status errors { message } } }',
    { u: { name, subjectId: String(manifest.ids.ontology_subject_field) }, team: String(teams.child.id), p: { locationId: SOUTH } })
  assert.equal(created.status, 'SUCCESS', q(created.errors))
  const roots = await graphql(page, 'query ($ids: [ID!]) { unitsRoots(locationIds: $ids) { result { id name } } }', { ids: [SOUTH] })
  root = roots.result.find((unit) => unit.name === name)?.id
  assert.ok(root, `${name} is at the field`)
  const children = await graphql(page,
    'mutation ($parents: UnitsSelection!, $subject: ID!, $team: ID!) { unitsAddChildren(parents: $parents, subjectId: $subject, count: 3, name: "{parent} plot {n}", controlTeamId: $team, release: PRIVATE) { status result { id name } errors { message } } }',
    { parents: { unitIds: [root] }, subject: String(manifest.ids.ontology_subject_plot), team: String(teams.child.id) })
  assert.equal(children.status, 'SUCCESS', q(children.errors))
  plots = children.result
})
after(async () => {
  try {
    for (const id of [...(plots ?? []).map((plot) => plot.id), root].filter(Boolean)) {
      await graphql(page, 'mutation ($id: ID!) { unitsDeleteUnit(id: $id) { status } }', { id })
    }
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`
const cell = (unitName, key) => `[...document.querySelectorAll('.placement-table tbody tr')].find((tr) => tr.querySelector('.unit-name').value === ${q(unitName)})?.querySelector('[data-cell$=":${key}"]')`
const status = (unitName) => page.evaluate(`[...document.querySelectorAll('.placement-table tbody tr')].find((tr) => tr.querySelector('.unit-name').value === ${q(unitName)}).querySelector('.status-column').innerText.trim()`)

const paste = (target, text) => page.evaluate(`(() => {
  const target = ${target}
  const data = new DataTransfer()
  data.setData('text/plain', ${q(text)})
  target.focus()
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
})()`)
const type = (target, value) => page.evaluate(`(() => {
  const input = ${target}
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(value)})
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)

async function openTable () {
  await page.goto(`${config.appUrl}/units?location=${SOUTH}&graph=${root}&unit=${root}`)
  await page.waitFor(`[...document.querySelectorAll('.tree-actions button')].some((b) => b.innerText.includes('Place units'))`, 30000)
  await page.clickText('Place units…')
  await page.waitFor(`document.querySelector('.place-units .hierarchical-multiselect')`, 30000)
  await page.waitFor(`document.querySelector('.place-units .place-empty')?.innerText.includes('Choose the units and the layout')`, 15000)

  // the field's layout of blocks
  const trigger = `[...document.querySelectorAll('.place-units .formkit-outer')].find((o) => o.querySelector('label')?.innerText.includes('Layout'))?.querySelector('.select-trigger')`
  await page.evaluate(`${trigger}.click()`)
  await page.waitFor(`${levelLoaded} && ${option(BLOCKS)}`, 30000)
  await page.evaluate(`${option(BLOCKS)}.querySelector('.option-label-button, .option-label').click()`)
  await page.waitFor(`document.querySelectorAll('.placement-table tbody tr').length === 3`, 30000)
}

test('a field sheet pasted on the units names fills their rows, and saved places each plot', { skip }, async () => {
  await openTable()
  const headers = await page.evaluate(`[...document.querySelectorAll('.placement-table th')].map((th) => th.innerText.trim())`)
  assert.deepEqual(headers, ['Unit', 'Germplasm', 'Block', 'Row', 'Tree', ''])
  const names = plots.map((plot) => plot.name)
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.placement-table .unit-name')].map((i) => i.value)`), names)

  // the day sown
  await page.evaluate(`(() => {
    const input = document.querySelector('.place-units input[name=start]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(SOWN)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

  // the sheet: a header line, the plots out of order and in another case, one not here, the last plot left out
  const sheet = [
    'Plot\tEntry\tBlock\tRow\tTree',
    `${names[1].toUpperCase()}\t${e.crop_line.name}\t2\t1\t3`,
    `${names[0]}\tNo such line\t1\t2\t1`,
    'Another field plot\tNo such line\t1\t1\t1'
  ].join('\n')
  await paste(cell(names[0], 'name'), sheet)
  await page.waitFor(`${cell(names[0], 'germplasm')}?.classList.contains('invalid')`, 15000)
  assert.match(await page.evaluate(`document.querySelector('.place-notice').innerText`), /^1 line named no unit here: Another field plot$/)
  assert.match(await status(names[0]), /No germplasm you can read is named “No such line”/)
  assert.equal(await page.evaluate(`document.querySelector('.place-units button[type=submit]').disabled`), true)

  // corrected
  await type(cell(names[0], 'germplasm'), e.crop_line.name)
  await page.waitFor(`!document.querySelector('.placement-table input.invalid')`, 15000)
  assert.equal(await status(names[0]), 'placed in Position South Block 1, germplasm set')
  assert.equal(await status(names[1]), 'placed in Position South Block 2, germplasm set')
  assert.equal(await status(names[2]), 'unchanged')
  assert.match(await page.evaluate(`document.querySelector('.place-summary').innerText`), /2 units to place, 2 given germplasm/)

  await page.click('.place-units button[type=submit]')
  await page.waitFor(`!document.querySelector('.place-units') || document.querySelector('.place-units .error-message')`, 30000)
  assert.equal(await page.evaluate(`document.querySelector('.place-units .error-message')?.innerText ?? null`), null)
  await page.waitFor(`document.querySelector('.notice')?.innerText.includes('Placed 2 units')`, 30000)

  const { result } = await graphql(page, UNITS, { ids: plots.map((plot) => plot.id) })
  const byName = Object.fromEntries(result.map((unit) => [unit.name, unit]))
  const where = (unit) => unit.positions.map((position) => [position.location.id, position.layout?.id, position.coordinates, position.start, position.end])
  assert.deepEqual(where(byName[names[0]]), [[SOUTH, BLOCK_1, ['2', '1'], SOWN, null]])
  assert.deepEqual(where(byName[names[1]]), [[SOUTH, BLOCK_2, ['1', '3'], SOWN, null]])
  assert.deepEqual(where(byName[names[2]]), [])
  assert.deepEqual(result.map((unit) => unit.germplasm?.id ?? null).sort(), [String(e.crop_line.id), String(e.crop_line.id), null].sort())
})

test('opened again, the table shows the plots where they were placed, unchanged', { skip }, async () => {
  await openTable()
  const names = plots.map((plot) => plot.name)
  const values = (name) => page.evaluate(`['germplasm', 'axis:Block', 'axis:Row', 'axis:Tree']
    .map((key) => [...document.querySelectorAll('.placement-table tbody tr')]
      .find((tr) => tr.querySelector('.unit-name').value === ${q(name)}).querySelector('[data-cell$=":' + key + '"]').value)`)
  assert.deepEqual(await values(names[0]), [e.crop_line.name, '1', '2', '1'])
  assert.deepEqual(await values(names[1]), [e.crop_line.name, '2', '1', '3'])
  assert.deepEqual(await values(names[2]), ['', '', '', ''])
  await page.evaluate(`(() => {
    const input = document.querySelector('.place-units input[name=start]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${q(SOWN)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  await page.waitFor(`[...document.querySelectorAll('.placement-table .status-column')].slice(1).every((td) => td.innerText.trim() === 'unchanged')`, 15000)
  // saving changes nothing, and says so
  await page.click('.place-units button[type=submit]')
  await page.waitFor(`document.querySelector('.place-units .error-message')`, 15000)
  assert.match(await page.evaluate(`document.querySelector('.place-units .error-message').innerText`), /Nothing changes/)
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.placement-table .unit-name')].map((i) => i.value)`), names)
})
