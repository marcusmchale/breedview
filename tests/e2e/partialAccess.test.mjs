// What a registered user outside every team sees: the entities released to registered users, the hidden ones
// between them skipped, and placeholders where a hidden entity is asked for directly or holds readable ones.
// The account and the releases are set up by lib/partialAccess.mjs (see there for the entities used).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql, flat } from './lib/app.mjs'
import { loginPartial, ensureReleases, released, hidden, names } from './lib/partialAccess.mjs'

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
  await loginPartial(page)
})
after(async () => { await logout(page); await browser?.close() })

const pageText = async () => flat(await page.text('main') ?? await page.text('body'))
// click every unexpanded expand button matching selector, level by level
const expandAll = async (selector) => {
  for (let level = 0; level < 8; level++) {
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})]; b.forEach((e) => e.click()); return b.length })()`)
    if (!clicked) return
    await page.sleep(2000)
  }
}
// dataset 6 has one record for each of 399 trees of Field A; dataset 5, also in Study A, stays private
const recordedUnits = 399
const hiddenDataset = 5
const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`

test('programs: the released study below placeholders for its hidden trial and program', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.body.innerText.includes('REDACTED')`, 30000)
  for (let level = 0; level < 2; level++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(names.study)})`, 30000)
  const text = await pageText()
  assert.equal(text.match(/REDACTED/g)?.length, 2, `the program and the trial are placeholders: ${text}`)
  const headings = await page.evaluate(`[...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((e) => e.innerText.trim())`)
  assert.ok(!headings.includes(names.program) && !headings.includes(names.trial), `their names are not shown: ${headings}`)
  assert.ok(page.consoleErrors().length === 0, `no console errors: ${page.consoleErrors()}`)
})

test('programs: no write actions are offered to a user without a team', async () => {
  const actions = await page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
    .filter((t) => /^(Create|Edit|Delete)/.test(t))`)
  assert.deepEqual(actions, [], 'create, edit and delete are hidden')
})

test('regions: the released location under its public country, past the hidden regions between them', async () => {
  await page.goto(`${config.appUrl}/regions`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  await expandAll('.location-header .expand-btn:not(.expanded)')
  const tree = await page.evaluate(`[...document.querySelectorAll('.location-node')].find((e) => e.querySelector('.location-name').innerText.trim() === ${JSON.stringify(names.country)})
    ?.querySelector('.children')?.innerText`)
  assert.ok(tree, `${names.country} has children`)
  assert.match(flat(tree), new RegExp(`^${names.location} \\| ${released.Location[0]}\\b`), `${names.location} is its child: ${flat(tree)}`)
  for (const name of names.hiddenLocations) assert.ok(!(await pageText()).includes(name), `${name} is not shown`)
})

test('blocks: the released tree under its field, past its hidden block', async () => {
  await page.goto(`${config.appUrl}/blocks`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  await expandAll('.location-header .expand-btn:not(.expanded)')
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(names.location)}).click()`)
  await page.waitFor(`document.querySelector('.block-item')`, 30000)
  const blocks = await page.evaluate(`[...document.querySelectorAll('.block-item .block-name')].map((e) => e.innerText.trim())`)
  assert.deepEqual(blocks, [names.field], 'the field is the only block')
  await page.click('.block-item')
  await page.waitFor(`document.querySelector('.tree-node .expand-btn')`, 30000)
  await page.click('.tree-node .expand-btn')
  await page.waitFor(`document.querySelectorAll('.tree-node').length > 1`, 30000)
  const nodes = await page.evaluate(`[...document.querySelectorAll('.tree-node .node-name')].map((e) => e.innerText.trim())`)
  assert.deepEqual(nodes, [names.field, names.tree], `the tree is the field's only child: ${nodes}`)
})

test('datasets: a search lists only the released datasets, and a hidden one asked for by id is a placeholder', async () => {
  const search = await graphql(page, `query ($ids: [ID!]) { datasets(studyIds: $ids) { result { id } } }`, { ids: released.Study })
  assert.deepEqual(search.result.map((d) => Number(d.id)), released.Dataset)
  const byId = await graphql(page, `query ($ids: [ID!]) { datasets(ids: $ids) { result { id studyId concept { name } recordCount records(limit: 1) { value } } } }`,
    { ids: [hiddenDataset, ...released.Dataset] })
  assert.deepEqual(byId.result[0], { id: String(hiddenDataset), studyId: null, concept: null, recordCount: 0, records: [] })
  assert.equal(byId.result[1].recordCount, recordedUnits, 'every record of the released dataset')
})

test('datasets: the units of a released dataset by subject, hidden ones as one group of placeholders', async () => {
  const payload = await graphql(page, `query ($ids: [ID!]!) { datasetsUnitsBySubject(datasetIds: $ids) { result { subject { name } units { id name } } } }`, { ids: released.Dataset })
  const groups = Object.fromEntries(payload.result.map((g) => [g.subject?.name ?? 'hidden', g.units]))
  assert.deepEqual(groups.Tree?.map((u) => Number(u.id)), [released.Unit[1]], 'the released tree')
  assert.equal(groups.hidden?.length, recordedUnits - 1, 'the other recorded units')
  assert.ok(groups.hidden.every((u) => u.name === 'REDACTED'), 'as placeholders')
})

test('curation: the released dataset with all its records, hidden units as placeholders under the field', async () => {
  await page.goto(`${config.appUrl}/datasets`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  const path = []
  while (await page.exists('.options-list .expand-button')) {
    path.push(...await optionLabels())
    await page.evaluate(`document.querySelector('.options-list .expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  assert.deepEqual(path, ['REDACTED', 'REDACTED'], 'the study is reached through placeholders')
  assert.deepEqual(await optionLabels(), [names.study])
  await page.evaluate(`document.querySelector('.options-list .option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=conceptIds] option') || document.querySelector('.no-concepts-msg')`, 60000)
  const concepts = await page.evaluate(`[...document.querySelectorAll('select[name=conceptIds] option')].map((o) => o.innerText.trim())`)
  assert.deepEqual(concepts, ['Factor A'], `the released dataset's concept is offered: ${flat(await page.text('.no-concepts-msg'))}`)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=conceptIds]'); s.options[0].selected = true; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  const hint = flat(await page.text('.datasets-hint'))
  assert.match(hint, /\b1 dataset\b/, `one dataset: ${hint}`)

  await page.evaluate(`document.querySelector('.record-filters .hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 60000)
  const roots = await optionLabels()
  assert.equal(roots.length, 1, `one root: ${roots}`)
  assert.match(roots[0], new RegExp(`^${names.field}\\b.*· ${recordedUnits} units$`), `the field, holding every recorded unit: ${roots}`)
  await page.evaluate(`document.querySelector('.options-list .expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 60000)
  // the recorded units hang from the field, hidden ones as placeholders; the hidden blocks between are skipped
  const children = await optionLabels()
  assert.equal(children.length, recordedUnits, `every recorded unit: ${children.length}`)
  assert.ok(children[0].startsWith(names.tree), `the released tree first: ${children[0]}`)
  assert.ok(children.slice(1).every((c) => c.startsWith('REDACTED')), 'the others are placeholders')
  assert.ok(!(await page.exists('.options-list .expand-button')), 'none of them holds anything')
  await page.click('.btn-done')
  await page.sleep(300)

  await page.evaluate(`[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table')).click()`)
  await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 60000)
  const rows = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.ok(rows.some((r) => r.includes(names.tree)), 'a row for the released tree')
  assert.ok(rows.some((r) => r.includes('REDACTED')), 'rows for the hidden units, as placeholders')
})

test('hidden entities asked for by id are placeholders', async () => {
  const units = await graphql(page, `query ($ids: [ID!]) { blocksUnits(ids: $ids) { result { id name subject { id } } } }`, { ids: hidden.Unit })
  assert.deepEqual(units.result.map((u) => [Number(u.id), u.name, u.subject]), hidden.Unit.map((id) => [id, 'REDACTED', null]))
})
