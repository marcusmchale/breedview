// The germplasm page's pedigree graph, as the admin, at the test database's crop_leaf: collapsing an entry's sinks
// hides every entry below it and expanding them shows its own sinks again, and its sources likewise above it; and a
// double-click collapses its sinks when they are all shown and shows them otherwise. What is below and above comes from
// the API's sources and sinks, as the page reads them.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities } from './lib/fixture.mjs'

const q = JSON.stringify
const ENTRY = entities.crop_leaf.name

let browser, page, family
before(async () => {
  browser = await launchBrowser({ height: 1400 }); page = browser.page
  await loginAs(page, 'admin')
  family = await pedigree()
})
after(async () => {
  try {
    await logout(page)
  } finally {
    await browser?.close()
  }
})

// Each entry's sources and sinks by name, and the names reached from one by following either
async function pedigree() {
  const { result } = await graphql(page, '{ germplasmEntries { result { id name sources { source { id } } sinks { sink { id } } } } }')
  const names = new Map(result.map((entry) => [entry.id, entry.name]))
  const byName = new Map(result.map((entry) => [entry.name, {
    sources: entry.sources.map((rel) => names.get(rel.source.id)).filter(Boolean),
    sinks: entry.sinks.map((rel) => names.get(rel.sink.id)).filter(Boolean)
  }]))
  const reached = (name, kind) => {
    const found = new Set()
    const visit = (next) => byName.get(next)[kind].forEach((other) => {
      if (other !== name && !found.has(other)) { found.add(other); visit(other) }
    })
    visit(name)
    return found
  }
  return { own: (name, kind) => byName.get(name)[kind], reached }
}

const graph = '.germplasm-network-graph'
// the circle drawn for an entry: d3 binds each its node, with the entry's name
const circle = (name) => `[...document.querySelectorAll('${graph} circle')].find((c) => c.__data__?.name === ${q(name)})`
const drawn = () => page.evaluate(`[...document.querySelectorAll('${graph} circle')].map((c) => c.__data__.name).sort()`)
const without = (names, hidden) => names.filter((name) => !hidden.has(name))

async function open() {
  await page.goto(`${config.appUrl}/germplasm`)
  await page.waitFor(`!!${circle(ENTRY)}`, 30000)
  return drawn()
}

async function fromMenu(item) {
  await page.evaluate(`(() => {
    const c = ${circle(ENTRY)}, r = c.getBoundingClientRect()
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  })()`)
  const menuItem = `[...document.querySelectorAll('.context-menu .menu-item')].find((m) => m.innerText.trim() === ${q(item)})`
  await page.waitFor(`!!${menuItem}`)
  await page.evaluate(`${menuItem}.click()`)
}

const doubleClick = () => page.evaluate(`${circle(ENTRY)}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))`)

// the graph is drawn again once the entries shown change
async function drawnAs(expected) {
  await page.waitFor(`${q(q(expected))} === JSON.stringify([...document.querySelectorAll('${graph} circle')].map((c) => c.__data__.name).sort())`, 10000)
    .catch(() => {})
  assert.deepEqual(await drawn(), expected)
}

test('collapsing an entry\'s sinks hides every entry below it, and expanding them shows its own sinks again', async () => {
  const all = await open()
  const below = family.reached(ENTRY, 'sinks')
  assert.ok(below.size > family.own(ENTRY, 'sinks').length, 'the entry has sinks with sinks of their own')
  const mark = page.mark()
  await fromMenu('Collapse Sinks')
  await drawnAs(without(all, below))
  await fromMenu('Expand Sinks')
  const own = new Set(family.own(ENTRY, 'sinks'))
  await drawnAs(without(all, new Set([...below].filter((name) => !own.has(name)))))
  assert.deepEqual(page.consoleErrors(mark), [])
})

test('collapsing an entry\'s sources hides every entry above it, and expanding them shows its own sources again', async () => {
  const all = await open()
  const above = family.reached(ENTRY, 'sources')
  assert.ok(above.size > family.own(ENTRY, 'sources').length, 'the entry has sources with sources of their own')
  const mark = page.mark()
  await fromMenu('Collapse Sources')
  await drawnAs(without(all, above))
  await fromMenu('Expand Sources')
  const own = new Set(family.own(ENTRY, 'sources'))
  await drawnAs(without(all, new Set([...above].filter((name) => !own.has(name)))))
  assert.deepEqual(page.consoleErrors(mark), [])
})

test('a double-click collapses an entry\'s sinks when they are all shown, and shows them otherwise', async () => {
  const all = await open()
  const below = family.reached(ENTRY, 'sinks')
  const own = new Set(family.own(ENTRY, 'sinks'))
  const mark = page.mark()
  await doubleClick()
  await drawnAs(without(all, below))
  await doubleClick()
  await drawnAs(without(all, new Set([...below].filter((name) => !own.has(name)))))
  // its own sinks are all shown, though theirs are not: it collapses them all again
  await doubleClick()
  await drawnAs(without(all, below))
  assert.deepEqual(page.consoleErrors(mark), [])
})
