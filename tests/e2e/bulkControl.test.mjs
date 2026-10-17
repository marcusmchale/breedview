// Bulk control on the Access control page, as the admin, who administers the root and child teams: what a team
// controls by kind and release, setting the release of a chosen dataset and of a tree's units, the unit tree opened
// down to the team's control roots, and sharing a tree's control with another team, which then renounces it.
// Every change is reverted; each leaves Control history behind.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, graphql } from './lib/app.mjs'
import { teams, entity } from './lib/fixture.mjs'

const q = JSON.stringify
const child = String(teams.child.id)
const root = String(teams.root.id)

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'admin')
})
after(async () => { browser?.close() })

const controls = async (label, id) => (await graphql(page,
  'query ($l: ControlledModelLabel!, $ids: [ID!]!) { controlsControllers(entityLabel: $l, entityIds: $ids) { result { controls { team { team { id } } release } } } }',
  { l: label, ids: [String(id)] })).result[0].controls.map((c) => `${c.team.team.id}:${c.release}`).sort()
const unitTree = async (teamId, parentIds = null) => (await graphql(page,
  'query ($t: ID!, $p: [ID!]) { controlsControlledUnits(teamId: $t, parentIds: $p) { result { unit { id name } release count } } }',
  { t: teamId, p: parentIds })).result

async function openBulk(teamId) {
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`[...document.querySelectorAll('.page-tab')].some((b) => b.innerText.includes('Bulk'))`, 30000)
  await page.clickText('Bulk control')
  await page.waitFor(`document.querySelector('select[name=bulkTeam]')`, 30000)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=bulkTeam]'); s.value = ${q(teamId)}; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.counts-table tbody tr')`, 30000)
  await page.sleep(800)
}

const chooseKind = async (label, ready) => {
  await page.evaluate(`document.querySelector('.counts-table tr[data-label=${label}] th button').click()`)
  await page.waitFor(ready, 30000)
  await page.sleep(500)
}

// Set the release of what is chosen, through the actions bar (the harness confirms), and wait for the result
const LABELS = { PRIVATE: 'Private', REGISTERED: 'Registered', PUBLIC: 'Public' }
async function setRelease(release) {
  await page.type('select[name=bulkRelease]', release)
  await page.clickText('Set release')
  await page.waitFor(`document.querySelector('.action-message')?.innerText.endsWith('to ${LABELS[release]}') || document.querySelector('.bulk-actions ~ .error-message')`, 60000)
  assert.equal(await page.exists('.bulk-actions ~ .error-message'), false, `no error: ${await page.text('.bulk-actions ~ .error-message')}`)
}

const unitRow = (id) => `document.querySelector('.unit-row[data-unit-id="${id}"]')`

test('bulk control: what a team controls, by kind and release, as the API counts it', async () => {
  const mark = page.mark()
  await openBulk(child)
  const counts = (await graphql(page, 'query ($t: [ID!]!) { controlsControlledCounts(teamIds: $t) { result { label release count } } }', { t: [child] })).result
  const shown = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('.counts-table tbody tr')].map((tr) =>
    [tr.dataset.label, [...tr.querySelectorAll('td')].map((td) => td.textContent.trim().replace(/,/g, ''))]))`)
  const releases = ['PRIVATE', 'REGISTERED', 'PUBLIC']
  for (const label of new Set(counts.map((c) => c.label))) {
    const expected = releases.map((r) => counts.filter((c) => c.label === label && c.release === r).reduce((n, c) => n + c.count, 0))
    assert.deepEqual(shown[label], [...expected.map((n) => (n ? String(n) : '–')), String(expected.reduce((a, b) => a + b))], label)
  }
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('bulk control: a chosen dataset\'s release is set, and set back', async () => {
  await openBulk(child)
  await chooseKind('DATASET', `document.querySelector('.controlled-table tbody tr td input')`)
  const page1 = (await graphql(page, 'query ($t: ID!) { controlsControlledEntities(teamId: $t, label: DATASET, release: PRIVATE) { result { items { id } } } }', { t: child })).result.items
  // a dataset of the scale studies, which no read-policy test depends on
  const readPolicyIds = new Set(['dataset_private', 'dataset_public', 'dataset_registered'].map((name) => String(entity(name).id)))
  const dataset = page1.map((item) => item.id).find((id) => !readPolicyIds.has(id))
  assert.deepEqual(await controls('DATASET', dataset), [`${child}:PRIVATE`])
  const check = `[...document.querySelectorAll('.controlled-table tbody tr')].find((tr) => tr.innerText.includes('#${dataset}')).querySelector('input')`
  for (const release of ['REGISTERED', 'PRIVATE']) {
    await page.evaluate(`${check}.click()`)
    await page.waitFor(`document.querySelector('.selection-description').innerText.trim() === '1 dataset'`)
    await setRelease(release)
    assert.deepEqual(await controls('DATASET', dataset), [`${child}:${release}`], `dataset ${dataset} is ${release}`)
    await page.waitFor(`!${check}.checked`, 30000)
  }
})

test('bulk control: the unit tree opens down to the topmost units the team controls', async () => {
  const mark = page.mark()
  await openBulk(child)
  await chooseKind('UNIT', `document.querySelector('.unit-rows .unit-row')`)
  // a unit graph root another team controls, holding a unit the child team does: opened to show it
  const hidden = String(entity('plot_public').id)
  const held = String(entity('plant_private').id)
  await page.waitFor(unitRow(held), 30000)
  assert.match(await page.evaluate(`${unitRow(hidden)}.innerText`), /not controlled by/, 'the root is shown, not controlled by the team')
  assert.equal(await page.evaluate(`${unitRow(hidden)}.querySelector('.expander').innerText`), '▼', 'and opened')
  assert.match(await page.evaluate(`${unitRow(held)}.innerText`), /Private/, 'down to the unit the team controls')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('bulk control: a tree and the units below it are set to a release, and set back', async () => {
  const field = (await unitTree(child)).filter((n) => n.release === 'PRIVATE').sort((a, b) => b.count - a.count)[0]
  const tree = (await unitTree(child, [field.unit.id])).find((n) => n.count > 1)
  const below = (await unitTree(child, [tree.unit.id])).map((n) => n.unit.id)
  await openBulk(child)
  await chooseKind('UNIT', `document.querySelector('.unit-rows .unit-row')`)
  await page.evaluate(`${unitRow(field.unit.id)}.querySelector('.expander').click()`)
  await page.waitFor(unitRow(tree.unit.id), 30000)
  for (const release of ['REGISTERED', 'PRIVATE']) {
    await page.evaluate(`${unitRow(tree.unit.id)}.querySelector('input').click()`)
    await page.waitFor(`document.querySelector('.selection-description').innerText.includes('${tree.count} units')`)
    await setRelease(release)
    for (const id of [tree.unit.id, ...below]) assert.deepEqual(await controls('UNIT', id), [`${child}:${release}`], `unit ${id} is ${release}`)
    await page.waitFor(`${unitRow(tree.unit.id)} && !${unitRow(tree.unit.id)}.querySelector('input').checked`, 30000)
  }
})

test('bulk control: a tree\'s control is shared with another team, which renounces it', async () => {
  const field = (await unitTree(child)).filter((n) => n.release === 'PRIVATE').sort((a, b) => b.count - a.count)[0]
  const tree = (await unitTree(child, [field.unit.id])).find((n) => n.count > 1)
  await openBulk(child)
  await chooseKind('UNIT', `document.querySelector('.unit-rows .unit-row')`)
  await page.evaluate(`${unitRow(field.unit.id)}.querySelector('.expander').click()`)
  await page.waitFor(unitRow(tree.unit.id), 30000)
  await page.evaluate(`${unitRow(tree.unit.id)}.querySelector('input').click()`)
  await page.clickText('Offer transfer')
  await page.waitFor(`document.querySelector('#recipient-team')`)
  await page.type('#recipient-team', root)
  await page.sleep(300)
  await page.check('.modal input[type=checkbox]:not([value])')
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('#recipient-team') && document.querySelector('.action-message')?.innerText.startsWith('Transferred')`, 60000)
  assert.deepEqual(await controls('UNIT', tree.unit.id), [`${child}:PRIVATE`, `${root}:PRIVATE`].sort(), 'both teams control it')

  // the root team's tree opens past the field it doesn't control to the shared tree, which it renounces
  await openBulk(root)
  await chooseKind('UNIT', `document.querySelector('.unit-rows .unit-row')`)
  await page.waitFor(unitRow(tree.unit.id), 30000)
  await page.evaluate(`${unitRow(tree.unit.id)}.querySelector('input').click()`)
  await page.clickText('Renounce')
  await page.waitFor(`document.querySelector('.action-message')?.innerText.includes('no longer controls') || document.querySelector('.bulk-actions ~ .error-message')`, 60000)
  assert.equal(await page.exists('.bulk-actions ~ .error-message'), false, `no error: ${await page.text('.bulk-actions ~ .error-message')}`)
  assert.deepEqual(await controls('UNIT', tree.unit.id), [`${child}:PRIVATE`], 'the child team alone controls it again')
})
