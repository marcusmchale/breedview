// What someone who is not signed in sees: the germplasm, programs, locations, units and datasets pages
// are open to them, showing what has been released to the public, with placeholders and skipped members as for anyone
// else (breedgraph docs/read-access.md), and no badges or write actions. The ontology page shows them the published
// version, without its drafts, commit history or roles. They see no people at all: no contributors or
// contacts, and no people page (docs/person.md §3). Other pages, the people page among them, send them to log in. The
// browser contacts no third party: maps and place searches come from our own servers. What the API returns is tested
// in breedgraph; here, that the pages show it without failing requests.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, expandProgramsUntil, flat, loginAs } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await browser?.close() })

const pageText = async () => flat(await page.text('main'))
const writeActions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /(Create|Edit|Delete|Add|New|Register|Position|Submit)/.test(t))`)
// the only request expected to fail: the check of who is signed in
const failedRequests = async (mark) => (await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:'))

test('the navigation offers the open pages and a way to log in, and the privacy notice and guide are a link away', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.nav-login')`, 30000)
  const links = await page.evaluate(`[...document.querySelectorAll('.nav-menu a')].map((e) => e.innerText.trim())`)
  assert.deepEqual(links, ['Programs', 'Locations', 'Units', 'Germplasm', 'Ontology', 'Log in'])
  await page.click('.app-footer a[href="/privacy"]')
  await page.waitFor(`location.pathname === '/privacy' && document.querySelector('.privacy-content h1')`, 30000)
  await page.click('.app-footer a[href="/guide"]')
  await page.waitFor(`location.pathname === '/guide' && document.querySelector('.guide-page .chapter-list a')`, 30000)
})

test('pages that need an account still send anonymous users to log in', async () => {
  for (const path of ['profile', 'people']) {
    await page.goto(`${config.appUrl}/${path}`)
    await page.waitFor(`location.pathname === '/login'`, 30000)
    assert.match(await page.url(), new RegExp(`redirect=(%2F|/)${path}`))
  }
})

test('the ontology: the published version, without the commit history, roles or editing', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`document.querySelectorAll('g.node').length > 0`, 30000)
  assert.equal(new URL(await page.url()).pathname, '/ontology')
  const text = await pageText()
  assert.match(text, /published/i, text)
  assert.ok(!/Ontology Role|Commit/.test(text), `no role or commit history: ${text}`)
  assert.equal(await page.exists('.buttons-panel, .version-actions'), false, 'no create or commit actions')
  assert.deepEqual(await failedRequests(mark), [])
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
  await expandProgramsUntil(page, `document.body.innerText.includes(${JSON.stringify(e.study_public.name)})`)
  const text = await pageText()
  assert.equal(text.match(/REDACTED/g)?.length, 2, 'the program and the trial are placeholders')
  for (const name of ['program_public', 'trial_public']) assert.ok(text.includes(e[name].name), `${name} is shown`)
  assert.ok(!text.includes(e.study_registered.name), 'the study released to registered users is not')
  assert.ok(!(await page.exists('.controller-badge')), 'no controller badges')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [])
})

test('programs: a visitor is offered View datasets alone, on the page and on a public study', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.programs-header .view-datasets')`, 30000)
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.programs-header .header-actions > *')].map((e) => e.innerText.trim())`),
    ['View datasets'])
  const card = `[...document.querySelectorAll('.study-card')].find((c) => c.innerText.includes(${JSON.stringify(e.study_public.name)}))`
  await expandProgramsUntil(page, `${card}?.querySelector('.section-toggle')`)
  await page.evaluate(`[...${card}.querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click()`)
  await page.waitFor(`${card}.querySelector('.dataset-actions .view-datasets')`, 30000)
  assert.deepEqual(await page.evaluate(`[...${card}.querySelector('.dataset-actions').children].map((e) => e.innerText.trim())`),
    ['View datasets'])
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
  await page.goto(`${config.appUrl}/units`)
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
  // open each level as it loads, its children coming some time after its button is pressed, until the tree is as
  // expected or half a minute has passed
  const expected = ['REDACTED', e.tree_public.name, e.rhizosphere_public.name]
  const shown = () => page.evaluate(`[...document.querySelectorAll('.tree-node .node-name')].map((e) => e.innerText.trim())`)
  for (const start = Date.now(); Date.now() - start < 30000 && JSON.stringify(await shown()) !== JSON.stringify(expected);) {
    await page.evaluate(`document.querySelectorAll('.tree-node .expand-btn:not(.expanded)').forEach((e) => e.click())`)
    await page.sleep(500)
  }
  assert.deepEqual(await shown(), expected, 'the private leaf between is skipped')
  assert.deepEqual(await writeActions(), [])
  assert.deepEqual(await failedRequests(mark), [], 'the location and unit types come from the published ontology')
})

test('locations: a public location is found by part of its name and opened, a hidden one is not found', async () => {
  const q = JSON.stringify
  const mark = page.mark()
  const search = async (text) => {
    await page.goto(`${config.appUrl}/locations`)
    await page.waitFor(`document.querySelector('.place-search-input')`, 30000)
    await page.type('.place-search-input', text)
    await page.click('.place-search-form button[type=submit]')
    await page.waitFor(`document.querySelector('.location-result, .place-search-message')`, 30000)
    return page.evaluate(`[...document.querySelectorAll('.location-result')].map((e) => e.innerText.trim())`)
  }
  assert.ok(!(await search(e.state.name.slice(1, -1).toLowerCase())).some((t) => t.includes(e.state.name)), 'the private state is not found')
  const found = await search(e.field.name.slice(1, -1).toLowerCase())
  assert.ok(found.some((t) => t.includes(e.field.name)), `the public field is found: ${found}`)
  await page.evaluate(`[...document.querySelectorAll('.location-result')].find((r) => r.innerText.includes(${q(e.field.name)})).click()`)
  await page.waitFor(`location.search.includes('location=${e.field.id}') && document.querySelector('.card-panel')?.innerText.includes(${q(e.field.name)})`, 30000)
  assert.deepEqual(await failedRequests(mark), [])
})

// The places the server finds (locationsSearchPlaces), as it would from GeoNames' places, whatever this site has fetched
const foundPlaces = `(() => {
  const fetched = window.fetch
  window.fetch = async (input, init) => {
    if (typeof init?.body !== 'string' || !init.body.includes('locationsSearchPlaces')) return fetched(input, init)
    const result = [{
      __typename: 'Place', name: 'Ballyduff', latitude: 52.45593, longitude: -9.66399, bounds: null,
      description: 'village', region: 'Kerry, Munster', country: 'Ireland', zoom: 14
    }]
    return new Response(JSON.stringify({ data: { locationsSearchPlaces: {
      __typename: 'PlacesPayload', status: 'SUCCESS', result, errors: null
    } } }), { headers: { 'Content-Type': 'application/json' } })
  }
})()`

test('locations: places are searched signed out too, listed with their kind and region, and credited', async () => {
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: foundPlaces })
  try {
    await page.goto(`${config.appUrl}/locations`)
    await page.waitFor(`document.querySelector('.place-search-input')`, 30000)
    assert.ok(await page.exists('.place-search-scope'), 'where to search is offered')
    await page.type('.place-search-input', 'ballyduff')
    await page.click('.place-search-form button[type=submit]')
    await page.waitFor(`document.querySelector('.place-results-credit')`, 30000)
    const places = await page.evaluate(`[...document.querySelectorAll('.place-result:not(.location-result)')].map((e) => e.innerText.trim())`)
    assert.deepEqual(places, ['Ballyduff\nvillage · Kerry, Munster, Ireland'])
    assert.equal(await page.text('.place-results-credit'), 'Places from GeoNames, CC BY 4.0')
    assert.ok(!(await page.exists('.place-result-add')), 'no location can be made of it signed out')
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
})

test('locations, units and programs: no request fails', async () => {
  for (const route of ['locations', 'units', 'programs']) {
    const mark = page.mark()
    await page.goto(`${config.appUrl}/${route}`)
    await page.sleep(4000)
    assert.deepEqual(await failedRequests(mark), [], route)
  }
})

test('the browser contacts no third party: maps and place searches come from our servers', async () => {
  const mark = page.mark()
  for (const route of ['programs', 'locations', 'units', 'germplasm', 'privacy', 'guide/looking-around']) {
    await page.goto(`${config.appUrl}/${route}`)
    await page.sleep(3000)
  }
  const ours = [new URL(config.appUrl).origin, new URL(config.apiUrl).origin]
  assert.deepEqual((await page.origins(mark)).filter((origin) => !ours.includes(origin)), [])
})
