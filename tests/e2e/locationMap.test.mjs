// The location map shows a location that has no coordinates where it would be: at the nearest place above it on the
// map, as a field just added to a farm is drawn there, not by its whole country. As the admin, on the test database's
// field_registered, which has coordinates and no children: the test adds a location below it each run, left behind.
// It reads tiles.json again while the page is open, as the server adds a country's extent and detailed maps in the
// background after the country is added. A place found by the place search, at field_registered's own point, is added
// as a location below it too, each run, left behind.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
// Leaflet sets window.L as it loads: collect each map it makes, to read its view
const COLLECT_MAPS = `(() => {
  let leaflet
  Object.defineProperty(window, 'L', { configurable: true, get: () => leaflet, set: (value) => {
    leaflet = value
    if (value?.Map?.addInitHook && !value.__testHooked) {
      value.__testHooked = true
      value.Map.addInitHook(function () { (window.__maps ??= []).push(this) })
    }
  } })
})()`

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1400 }); page = browser.page
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: COLLECT_MAPS })
  await loginAs(page, 'admin')
})
after(async () => { await logout(page); await browser?.close() })

test('a location without coordinates is shown at the nearest place above it on the map', async () => {
  const { result: [parent, lab] } = await graphql(page,
    'query ($ids: [ID!]!) { locationsLocations(ids: $ids) { result { id coordinates { latitude longitude } type { id } } } }',
    { ids: [String(e.field_registered.id), String(e.lab.id)] })
  assert.ok(parent.coordinates.length, 'field_registered has coordinates')
  const name = uniqueName('E2E unplaced ')
  const created = await graphql(page,
    'mutation ($location: LocationInput!, $team: ID!) { locationsCreateLocation(location: $location, controlTeamId: $team, release: PRIVATE) { status errors { message } } }',
    { location: { name, typeId: lab.type.id, parentId: parent.id }, team: String(teams.root.id) })
  assert.equal(created.status, 'SUCCESS', q(created.errors))
  const { result: found } = await graphql(page, 'query ($name: String!) { locationsSearch(name: $name) { result { id name } } }', { name })
  const location = found.find((l) => l.name === name)

  await page.goto(`${config.appUrl}/locations?location=${location.id}`)
  await page.waitFor(`document.querySelector('.details-card h2')?.innerText.trim() === ${q(name)} && window.__maps?.some((m) => m.getContainer().isConnected)`, 30000)
  const [{ latitude, longitude }] = parent.coordinates
  const map = `window.__maps.find((m) => m.getContainer().isConnected)`
  // the view settles once the parent and its children are read
  await page.waitFor(`${map}.getZoom() >= 14 && ${map}.getBounds().contains([${latitude}, ${longitude}])`, 15000)
  assert.ok((await page.text('.map-panel')).includes(`No locations below ${name}`))
})

// tiles.json as the server rewrites it while the page is open, after a country is added: the first read lacks the
// country, and each later one has its extent and a detailed region (a file never asked for at the zooms shown)
const EXTENT = [[30, 50], [31, 51]]
const addedLater = (code, name) => `(() => {
  const fetched = window.fetch
  window.__tilesReads = 0
  window.fetch = async (input, init) => {
    const response = await fetched(input, init)
    if (!String(input).endsWith('/tiles/tiles.json') || !response.ok) return response
    const tiles = await response.json()
    window.__tilesReads += 1
    const countries = { ...tiles.countries }
    delete countries[${q(code)}]
    const layers = tiles.layers.filter((layer) => !layer.url.startsWith(${q(`regions/${code}`)}))
    if (window.__tilesReads > 1) {
      countries[${q(code)}] = { name: ${q(name)}, bounds: ${q(EXTENT)} }
      layers.push({ url: ${q(`regions/${code}.pmtiles`)}, name: ${q(name)}, minZoom: layers[0].maxZoom + 1, maxZoom: 15, bounds: ${q(EXTENT)} })
    }
    return new Response(JSON.stringify({ ...tiles, countries, layers }), { headers: { 'Content-Type': 'application/json' } })
  }
})()`

test('a country added while the page is open is shown by its extent and drawn in detail, without a reload', async (t) => {
  const served = await fetch(`${config.apiUrl}/tiles/tiles.json`).catch(() => null)
  if (!served?.ok) return t.skip('the API serves no map tiles (README, Prerequisites)')
  const { result: [country] } = await graphql(page,
    'query ($ids: [ID!]!) { locationsLocations(ids: $ids) { result { name code } } }', { ids: [String(e.country.id)] })
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: addedLater(country.code, country.name) })
  try {
    await page.goto(`${config.appUrl}/locations?location=${e.field.id}`)
    const map = `window.__maps.find((m) => m.getContainer().isConnected)`
    const drawsRegion = `Object.values(${map}._layers).some((layer) => layer.options?.url?.regions?.some((region) => region.url === ${q(`regions/${country.code}.pmtiles`)}))`
    await page.waitFor(`window.__tilesReads === 1 && window.__maps?.some((m) => m.getContainer().isConnected)`, 30000)
    assert.equal(await page.evaluate(drawsRegion), false, 'not in the first read')
    await page.sleep(3500) // past the pause between reads of tiles.json

    // the country chosen in the tree, as when its maps were fetched since the page loaded
    await page.waitFor(`[...document.querySelectorAll('.regions-tree .location-name')].some((n) => n.innerText.trim() === ${q(country.name)})`, 30000)
    await page.evaluate(`[...document.querySelectorAll('.regions-tree .location-name')].find((n) => n.innerText.trim() === ${q(country.name)}).click()`)
    const [[south, west], [north, east]] = EXTENT
    await page.waitFor(`${map}.getBounds().contains([[${south}, ${west}], [${north}, ${east}]]) && ${map}.getZoom() >= 7`, 15000)
    assert.equal(await page.evaluate(drawsRegion), true, 'its region drawn')
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
})

// The status the server gives of a country's detailed maps (locationsMapStatus): divided, with a region being fetched
const dividedStatus = (code) => `(() => {
  const fetched = window.fetch
  window.fetch = async (input, init) => {
    if (typeof init?.body !== 'string' || !init.body.includes('locationsMapStatus')) return fetched(input, init)
    window.__statusReads = (window.__statusReads ?? 0) + 1
    const result = {
      __typename: 'CountryMapStatus', code: ${q(code)}, state: 'DIVIDED', size: 5.5e9, limit: 2e9, enabled: true, error: null,
      sections: [{ __typename: 'MapSectionStatus', name: 'Alpha', state: 'FETCHING', size: 9e8, error: null }],
      places: { __typename: 'PlacesStatus', state: 'READY', enabled: true, towns: true, error: null }
    }
    return new Response(JSON.stringify({ data: { locationsMapStatus: {
      __typename: 'CountryMapStatusPayload', status: 'SUCCESS', result, errors: null
    } } }), { headers: { 'Content-Type': 'application/json' } })
  }
})()`

test('the map says where the detailed maps of the selected location\'s country stand', async () => {
  const { result: [country] } = await graphql(page,
    'query ($ids: [ID!]!) { locationsLocations(ids: $ids) { result { name code } } }', { ids: [String(e.country.id)] })
  const real = await graphql(page,
    'query ($code: String!) { locationsMapStatus(code: $code) { status result { code state limit enabled sections { name } } } }',
    { code: country.code })
  assert.equal(real.status, 'SUCCESS')
  assert.equal(real.result.code, country.code)

  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: dividedStatus(country.code) })
  try {
    // a field in the country: its country's maps are spoken of
    await page.goto(`${config.appUrl}/locations?location=${e.field.id}`)
    await page.waitFor(`document.querySelectorAll('.map-panel .map-status').length === 2`, 30000)
    const messages = await page.evaluate(`[...document.querySelectorAll('.map-panel .map-status')].map((p) => p.textContent.trim())`)
    assert.deepEqual(messages, [
      `${country.name}'s detailed maps would take 5.5 GB, more than this site's limit of 2.0 GB for one country, so ` +
        'each of its regions, such as a state or province, is fetched when a location in it is placed on the map.',
      'Detailed maps of Alpha (0.9 GB) are being fetched, and appear on the map when they are ready.'
    ])
    // asked for again while a region is being fetched, every ten seconds
    const reads = await page.evaluate('window.__statusReads')
    await page.waitFor(`window.__statusReads > ${reads}`, 15000)
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
})

// A place the server finds (locationsSearchPlaces), as it would among GeoNames' places, whatever this site has fetched
const foundPlace = (place) => `(() => {
  const fetched = window.fetch
  window.fetch = async (input, init) => {
    if (typeof init?.body !== 'string' || !init.body.includes('locationsSearchPlaces')) return fetched(input, init)
    return new Response(JSON.stringify({ data: { locationsSearchPlaces: {
      __typename: 'PlacesPayload', status: 'SUCCESS', result: [{ __typename: 'Place', ...${q(place)} }], errors: null
    } } }), { headers: { 'Content-Type': 'application/json' } })
  }
})()`

test('a place found is added as a location below the one selected, filled in from it, and then selected', async () => {
  const { result: [country, field, lab] } = await graphql(page,
    'query ($ids: [ID!]!) { locationsLocations(ids: $ids) { result { id name code type { id name } coordinates { latitude longitude } } } }',
    { ids: [String(e.country.id), String(e.field_registered.id), String(e.lab.id)] })
  const name = uniqueName('E2E place ')
  // its kind is a location type of the site's, so the dialog starts with that type; at the field's own point, so the
  // field is still shown close up with its children (the first test)
  const [{ latitude, longitude }] = field.coordinates
  const place = {
    name, latitude, longitude, bounds: null, description: lab.type.name.toLowerCase(), region: 'Tehran',
    country: 'Iran', countryCode: country.code, zoom: 16
  }
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: foundPlace(place) })
  try {
    await page.goto(`${config.appUrl}/locations?location=${field.id}`)
    await page.waitFor(`document.querySelector('.details-card h2')?.innerText.trim() === ${q(field.name)}`, 30000)
    await page.type('.place-search-input', 'a place')
    await page.click('.place-search-form button[type=submit]')
    await page.waitFor(`document.querySelector('.place-result-add')`, 30000)
    assert.equal((await page.text('.place-result-add')).trim(), 'Add as a location')
    await page.click('.place-result-add')
    await page.waitFor(`document.querySelector('.modal input[name=name]')?.value === ${q(name)}`, 30000)
    const form = await page.evaluate(`({
      parent: document.querySelector('.modal input[name=parentName]').value,
      type: document.querySelector('.modal select[name=typeId]').selectedOptions[0]?.innerText.trim(),
      address: document.querySelector('.modal input[name=address]').value,
      point: document.querySelector('.modal .place-point')?.innerText
    })`)
    assert.deepEqual({ ...form, point: form.point?.includes(`${latitude}, ${longitude}`) }, {
      parent: field.name, type: lab.type.name, address: 'Tehran, Iran', point: true
    })
    await page.click('.modal button[type=submit]')
    await page.waitFor(`!document.querySelector('.modal') && document.querySelector('.details-card h2')?.innerText.trim() === ${q(name)}`, 30000)
    const id = new URL(await page.url()).searchParams.get('location')
    const { result: [made] } = await graphql(page,
      'query ($ids: [ID!]!) { locationsLocations(ids: $ids) { result { name address parent { id } type { id } coordinates { latitude longitude } } } }',
      { ids: [id] })
    assert.deepEqual(made, {
      name, address: 'Tehran, Iran', parent: { id: String(field.id) }, type: { id: lab.type.id },
      coordinates: [{ latitude, longitude }]
    })
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
})
