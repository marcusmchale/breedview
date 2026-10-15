// What someone who is not signed in sees: the programs, regions, arrangements, blocks and datasets pages are open to
// them, showing what has been released to the public, with placeholders and skipped members as for anyone else
// (breedgraph docs/read-access.md). The releases are set up by lib/partialAccess.mjs: the Study A study, dataset 6,
// field Field A and location Field A are public; the Variety A tree is released to registered users only.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql, flat } from './lib/app.mjs'
import { ensureReleases, releasedTo, released, references, names } from './lib/partialAccess.mjs'

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
})
after(async () => { await browser?.close() })

const pageText = async () => flat(await page.text('main'))
const writeActions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /(Create|Edit|Delete|Add|New|Register|Position)/.test(t))`)
const publicTree = releasedTo.REGISTERED.Unit[0]
// the only request expected to fail: the check of who is signed in
const failedRequests = async (mark) => (await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:'))

test('the navigation offers the open pages and a way to log in', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.nav-login')`, 30000)
  const links = await page.evaluate(`[...document.querySelectorAll('.nav-menu a')].map((e) => e.innerText.trim())`)
  assert.deepEqual(links, ['Germplasm', 'Regions', 'Arrangements', 'Blocks', 'Programs', 'Datasets', 'Log in'])
})

test('pages that need an account still send anonymous users to log in', async () => {
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`location.pathname === '/login'`, 30000)
  assert.match(await page.url(), /redirect=(%2F|\/)profile/)
})

test('programs: the public study below placeholders, without badges or write actions', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.body.innerText.includes('REDACTED')`, 30000)
  for (let level = 0; level < 2; level++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(names.study)})`, 30000)
  assert.equal((await pageText()).match(/REDACTED/g)?.length, 2, 'the program and the trial are placeholders')
  assert.ok(!(await page.exists('.controller-badge')), 'no controller badges')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [])
})

test('blocks: the public field, without the tree released to registered users only', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/blocks`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  await page.evaluate(`document.querySelectorAll('.location-header .expand-btn:not(.expanded)').forEach((e) => e.click())`)
  await page.waitFor(`[...document.querySelectorAll('.location-name')].some((e) => e.innerText.trim() === ${JSON.stringify(names.location)})`, 30000)
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(names.location)}).click()`)
  await page.waitFor(`document.querySelector('.block-item')`, 30000)
  await page.click('.block-item')
  await page.waitFor(`document.querySelector('.tree-node .node-name')`, 30000)
  await page.sleep(1000)
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.tree-node .node-name')].map((e) => e.innerText.trim())`), [names.field])
  assert.ok(!(await page.exists('.tree-node .expand-btn')), 'the field holds nothing an anonymous user can see')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [], 'the location and unit types come from the published ontology')
})

test('the ontology: published and referenced entries, not the editorial view of drafts', async () => {
  const published = await graphql(page, 'query { ontologyEntries(labels: [SUBJECT]) { status result { name } } }')
  assert.ok(published.result.some((e) => e.name === 'Tree'), 'published subjects')
  const referenced = await graphql(page, 'query { ontologyEntries(ids: [269], view: REFERENTIAL) { status result { name } } }')
  assert.deepEqual(referenced.result.map((e) => e.name), ['Factor A'], "the public dataset's concept, as referenced")
  const editorial = await graphql(page, 'query { ontologyEntries(labels: [SUBJECT], view: EDITORIAL) { status errors { message } } }')
  assert.equal(editorial.status, 'ERROR')
})

test('regions, arrangements and datasets: no request fails', async () => {
  for (const route of ['regions', 'arrangements', 'datasets']) {
    const mark = page.mark()
    await page.goto(`${config.appUrl}/${route}`)
    await page.sleep(4000)
    assert.deepEqual(await failedRequests(mark), [], route)
  }
})

test('datasets: the public dataset, its units hidden from anonymous users as placeholders', async () => {
  const search = await graphql(page, `query ($ids: [ID!]) { datasets(studyIds: $ids) { result { id recordCount } } }`, { ids: releasedTo.PUBLIC.Study })
  assert.deepEqual(search.result.map((d) => Number(d.id)), released.Dataset)
  const level = (parentIds) => graphql(page, `query ($ids: [ID!]!, $parents: [ID!]) { datasetsUnits(datasetIds: $ids, parentIds: $parents) {
    result { unit { id name } unitCount } } }`, { ids: released.Dataset, parents: parentIds })
  const roots = (await level(null)).result
  assert.deepEqual(roots.map((r) => [r.unit.name, r.unitCount]), [[names.field, search.result[0].recordCount]])
  const children = (await level([roots[0].unit.id])).result
  assert.ok(children.every((c) => c.unit.name === 'REDACTED'), 'every recorded unit is a placeholder, the tree too')
  assert.ok(children.some((c) => Number(c.unit.id) === publicTree), 'the registered-only tree among them')
})
