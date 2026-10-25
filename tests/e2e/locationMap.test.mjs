// The location map shows a location that has no coordinates where it would be: at the nearest place above it on the
// map, as a field just added to a farm is drawn there, not by its whole country. As the admin, on the test database's
// field_registered, which has coordinates and no children: the test adds a location below it each run, left behind.
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
