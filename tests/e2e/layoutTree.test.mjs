// Adding a child layout keeps the layout tree as it was opened and lists the new child in it, so blocks are added one
// after another without opening the tree each time. Signed in as the writer, who curates the positions scenario
// (manifest `positions`; skipped without them), on Position South Blocks and its two blocks: the test adds a third and
// deletes it again.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, uniqueName } from './lib/app.mjs'
import { positions as p } from './lib/fixture.mjs'

const skip = p ? false : 'the test database manifest has no positions: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify
const TREE = 'Position South Blocks'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'writer') })
after(async () => { await logout(page); await browser?.close() })

const node = (name) => `[...document.querySelectorAll('.location-layouts-panel .tree-panel .node-header')].find((h) => h.querySelector('.node-name')?.innerText.trim() === ${q(name)})`
const card = (selector) => `document.querySelector(${q(`.location-layouts-panel .card-panel ${selector}`)})`
const shown = () => page.evaluate(`[...document.querySelectorAll('.location-layouts-panel .tree-panel .node-name')].map((n) => n.innerText.trim())`)

test('a child layout added shows in the open tree, which stays open', { skip }, async () => {
  await page.goto(`${config.appUrl}/locations?location=${p.locations['Position Field South']}`)
  const item = `[...document.querySelectorAll('.layout-item')].find((i) => i.querySelector('.layout-name')?.innerText.trim() === ${q(TREE)})`
  await page.waitFor(item, 30000)
  await page.evaluate(`${item}.click()`)
  await page.waitFor(`${node(TREE)}?.querySelector('.expand-btn')`, 30000)
  await page.evaluate(`${node(TREE)}.querySelector('.expand-btn').click()`)
  await page.waitFor(node('Position South Block 2'), 15000)
  const before = await shown()

  // a third block, from the tree's card
  await page.evaluate(`${node(TREE)}.click()`)
  await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(TREE)} && ${card('.btn-add-child')}`, 15000)
  await page.evaluate(`${card('.btn-add-child')}.click()`)
  await page.waitFor(`document.querySelector('.modal input[name=position_0]')`, 15000)
  const name = uniqueName('E2E block ')
  for (const input of await page.evaluate(`[...document.querySelectorAll('.modal input[name^=position_]')].map((i) => i.name)`)) {
    await page.type(`.modal input[name=${input}]`, '3')
  }
  await page.type('.modal input[name=name]', name)
  await page.evaluate(`(() => { const s = document.querySelector('.modal select[name=typeId]'); s.selectedIndex = [...s.options].findIndex((o) => o.value); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(500)
  for (const input of await page.evaluate(`[...document.querySelectorAll('.modal input[name^=axis_]')].map((i) => i.name)`)) {
    await page.type(`.modal input[name=${input}]`, input === 'axis_0' ? 'Row' : 'Column')
  }
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal') || document.querySelector('.modal .error-message')`, 30000)
  assert.equal(await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`), null)

  await page.waitFor(node(name), 15000)
  assert.ok(await page.evaluate(`${node(TREE)}.querySelector('.expand-btn').classList.contains('expanded')`), 'the tree stays open')
  assert.deepEqual(await shown(), [...before, name])

  // deleted again
  await page.evaluate(`${node(name)}.click()`)
  const deleteButton = `[...document.querySelectorAll('.location-layouts-panel .card-panel .card-actions button')].find((b) => b.innerText.includes('Delete'))`
  await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(name)} && ${deleteButton}`, 15000)
  await page.evaluate(`${deleteButton}.click()`)
  await page.waitFor(`document.querySelector('.modal .btn-danger')`, 15000)
  await page.click('.modal .btn-danger')
  await page.waitFor(`!${node(name)}`, 30000)
})
