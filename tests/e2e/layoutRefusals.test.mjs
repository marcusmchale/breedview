// A layout units are positioned in can't be deleted (breedgraph 2026-10-23): the Locations page shows the refusal as
// the API gives it. Signed in as the writer, who curates the positions scenario (manifest `positions`; skipped without
// them). Nothing changes.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { positions as p } from './lib/fixture.mjs'

const skip = p ? false : 'the test database manifest has no positions: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const LAYOUT = 'Position North Rows'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'writer') })
after(async () => { await logout(page); await browser?.close() })

test('deleting a layout tree units are positioned in is refused, as the API says', { skip }, async () => {
  await page.goto(`${config.appUrl}/locations?location=${p.locations['Position Field North']}`)
  const item = `[...document.querySelectorAll('.layout-item')].find((i) => i.querySelector('.layout-name')?.innerText.trim() === ${q(LAYOUT)})`
  await page.waitFor(item, 30000)
  await page.evaluate(`${item}.click()`)
  const deleteButton = `[...document.querySelectorAll('.location-layouts-panel .card-panel .card-actions button')].find((b) => b.innerText.includes('Delete'))`
  await page.waitFor(`document.querySelector('.location-layouts-panel .card-panel h2')?.innerText.trim() === ${q(LAYOUT)} && ${deleteButton}`, 30000)
  const mark = page.mark()

  await page.evaluate(`${deleteButton}.click()`)
  await page.waitFor(`document.querySelector('.modal .btn-danger')`, 15000)
  await page.click('.modal .btn-danger')
  await page.waitFor(`document.querySelector('.modal .error-message')`, 15000)
  assert.equal(
    (await page.text('.modal .error-message')).trim(),
    'Units are positioned in this layout, so it may not be deleted: remove or move their positions first.'
  )
  await page.click('.modal .btn-secondary')
  await page.waitFor(`!document.querySelector('.modal')`, 15000)

  const layouts = await graphql(page, 'query ($ids: [ID!]) { layoutsLayouts(ids: $ids) { result { id name } } }', { ids: [String(p.layouts[LAYOUT])] })
  assert.deepEqual(layouts.result.map((layout) => layout.name), [LAYOUT], 'the layout is still there')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
