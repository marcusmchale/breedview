// What someone who is not signed in sees: the germplasm, programs, regions, arrangements, blocks and datasets pages
// are open to them, showing what has been released to the public, with placeholders and skipped members as for anyone
// else (breedgraph docs/read-access.md), and no badges or write actions. They see no people at all: no contributors or
// contacts, and no people page (docs/person.md §3). Other pages, the people page among them, send them to log in. The
// browser contacts no third party: maps and place searches come from our own servers. What the API returns is tested
// in breedgraph; here, that the pages show it without failing requests.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, flat, loginAs } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await browser?.close() })

const pageText = async () => flat(await page.text('main'))
const writeActions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /(Create|Edit|Delete|Add|New|Register|Position)/.test(t))`)
// the only request expected to fail: the check of who is signed in
const failedRequests = async (mark) => (await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:'))

test('the navigation offers the open pages and a way to log in, and the privacy notice is a link away', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.nav-login')`, 30000)
  const links = await page.evaluate(`[...document.querySelectorAll('.nav-menu a')].map((e) => e.innerText.trim())`)
  assert.deepEqual(links, ['Programs', 'Locations', 'Germplasm', 'Log in'])
  await page.click('.app-footer a')
  await page.waitFor(`location.pathname === '/privacy' && document.querySelector('.privacy-content h1')`, 30000)
})

test('pages that need an account still send anonymous users to log in', async () => {
  for (const path of ['profile', 'people']) {
    await page.goto(`${config.appUrl}/${path}`)
    await page.waitFor(`location.pathname === '/login'`, 30000)
    assert.match(await page.url(), new RegExp(`redirect=(%2F|/)${path}`))
  }
})

test('home, and an address that is no page, are the programs for anonymous users', async () => {
  for (const path of ['/', '/no-such-page']) {
    await page.goto(`${config.appUrl}${path}`)
    await page.waitFor(`location.pathname === '/programs'`, 30000)
  }
})

test('logging out on an open page stays there, showing only what is public; elsewhere it leaves for the programs', async () => {
  const q = JSON.stringify
  await loginAs(page, 'writer')
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.body.innerText.includes(${q(e.program.name)})`, 30000)
  await page.click('.nav-logout')
  await page.waitFor(`document.querySelector('.nav-login')`, 15000)
  assert.equal(new URL(await page.url()).pathname, '/programs', 'still on the programs')
  await page.waitFor(`document.body.innerText.includes(${q(e.program_public.name)})`, 30000)
  await page.sleep(500)
  assert.ok(!(await pageText()).includes(e.program.name), 'the private program is no longer shown')

  await loginAs(page, 'writer')
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`document.querySelector('.nav-logout')`, 30000)
  await page.click('.nav-logout')
  await page.waitFor(`location.pathname === '/programs' && document.querySelector('.nav-login')`, 15000)
})

test('programs: the public studies below placeholders, without badges or write actions', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.body.innerText.includes('REDACTED')`, 30000)
  for (let level = 0; level < 2; level++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(e.study_public.name)})`, 30000)
  const text = await pageText()
  assert.equal(text.match(/REDACTED/g)?.length, 2, 'the program and the trial are placeholders')
  for (const name of ['program_public', 'trial_public']) assert.ok(text.includes(e[name].name), `${name} is shown`)
  assert.ok(!text.includes(e.study_registered.name), 'the study released to registered users is not')
  assert.ok(!(await page.exists('.controller-badge')), 'no controller badges')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [])
})

test('programs: no one is credited or named as a contact for signed-out visitors', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/programs`)
  // program_public has a contact and a contributor (PROGRAM_CREDITS in breedgraph's read-policy scenario), released to
  // registered users only, as Persons are
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(e.program_public.name)})`, 30000)
  await page.sleep(2000)
  const text = await pageText()
  for (const name of ['person_admin', 'person_public']) assert.ok(!text.includes(e[name].name), `${name} is not shown`)
  assert.ok(!(await page.exists('.contributions-list')), 'no contributions')
  assert.ok(!(await page.exists('.contacts-display')), 'no contacts')
  assert.deepEqual(await failedRequests(mark), [])
})

test('units: the public tree under a placeholder for its hidden unit graph root, without the registered one', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/locations?tab=units`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  // open the tree until the field is listed (a click while the tree first renders can be lost)
  const fieldListed = `[...document.querySelectorAll('.location-name')].some((e) => e.innerText.trim() === ${JSON.stringify(e.field.name)})`
  for (let attempt = 0; attempt < 6 && !(await page.evaluate(fieldListed)); attempt++) {
    await page.evaluate(`document.querySelectorAll('.location-header .expand-btn:not(.expanded)').forEach((e) => e.click())`)
    await page.sleep(2000)
  }
  await page.waitFor(fieldListed, 30000)
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(e.field.name)}).click()`)
  await page.waitFor(`document.querySelector('.block-item')`, 30000)
  await page.click('.block-item')
  await page.waitFor(`document.querySelector('.tree-node .expand-btn')`, 30000)
  for (let level = 0; level < 4 && await page.exists('.tree-node .expand-btn:not(.expanded)'); level++) {
    await page.evaluate(`document.querySelectorAll('.tree-node .expand-btn:not(.expanded)').forEach((e) => e.click())`)
    await page.sleep(2000)
  }
  const nodes = await page.evaluate(`[...document.querySelectorAll('.tree-node .node-name')].map((e) => e.innerText.trim())`)
  assert.deepEqual(nodes, ['REDACTED', e.tree_public.name, e.rhizosphere_public.name], 'the private leaf between is skipped')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [], 'the location and unit types come from the published ontology')
})

test('locations and programs: no request fails', async () => {
  for (const route of ['locations', 'programs']) {
    const mark = page.mark()
    await page.goto(`${config.appUrl}/${route}`)
    await page.sleep(4000)
    assert.deepEqual(await failedRequests(mark), [], route)
  }
})

test('the browser contacts no third party: maps and place searches come from our servers', async () => {
  const mark = page.mark()
  for (const route of ['programs', 'locations', 'germplasm', 'privacy']) {
    await page.goto(`${config.appUrl}/${route}`)
    await page.sleep(3000)
  }
  const ours = [new URL(config.appUrl).origin, new URL(config.apiUrl).origin]
  assert.deepEqual((await page.origins(mark)).filter((origin) => !ours.includes(origin)), [])
})
