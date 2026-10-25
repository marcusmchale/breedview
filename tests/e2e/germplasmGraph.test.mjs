// The germplasm page's pedigree graph, as the admin, in a window too narrow for the test database's pedigree at full
// size: it opens zoomed to fit its box, and a zoom while it first settles is kept. At crop_leaf: collapsing an entry's
// sinks hides every entry below it and expanding them shows its own sinks again, and its sources likewise above it; a
// double-click collapses its sinks when they are all shown and shows them otherwise; the entry stays where it is on
// the screen through each, in the view as it was zoomed, while the graph settles around it; a double-click on an
// entry does not zoom; and a source or sink on an entry's card opens its own card. What is below and above comes from
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
  browser = await launchBrowser({ width: 720, height: 1400 }); page = browser.page
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

const doubleClick = (name = ENTRY) => page.evaluate(`(() => {
  const c = ${circle(name)}, r = c.getBoundingClientRect()
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
})()`)

// where an entry's circle is on the screen, and the view the graph is zoomed and panned to
const centre = (name) => page.evaluate(`(() => { const r = ${circle(name)}.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()`)
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1
const view = () => page.evaluate(`document.querySelector('${graph} svg > g').getAttribute('transform')`)

// the layout runs for a few seconds after each change, until nothing moves at all (the first drawing's fit with it)
async function settled() {
  const positions = () => page.evaluate(`JSON.stringify([...document.querySelectorAll('${graph} circle')].map((c) => { const r = c.getBoundingClientRect(); return [r.x, r.y] }))`)
  let last = await positions()
  for (let i = 0; i < 40; i++) {
    await page.sleep(500)
    const now = await positions()
    if (now === last) return
    last = now
  }
  throw new Error('the graph did not settle')
}

// the graph is drawn again once the entries shown change
async function drawnAs(expected) {
  await page.waitFor(`${q(q(expected))} === JSON.stringify([...document.querySelectorAll('${graph} circle')].map((c) => c.__data__.name).sort())`, 10000)
    .catch(() => {})
  assert.deepEqual(await drawn(), expected)
}

test('the pedigree opens zoomed to fit its box', async () => {
  const all = await open()
  await settled()
  const outside = await page.evaluate(`(() => {
    const box = document.querySelector('${graph}').getBoundingClientRect()
    return [...document.querySelectorAll('${graph} circle, ${graph} text')].filter((e) => {
      const r = e.getBoundingClientRect()
      return r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1
    }).map((e) => e.textContent.trim() || e.__data__?.name)
  })()`)
  assert.deepEqual(outside, [], `all ${all.length} entries are in the box`)
})

test('a zoom while the pedigree first settles is kept', async () => {
  await open()
  // the layout runs for a few seconds after the first drawing
  await page.evaluate(`(() => {
    const svg = document.querySelector('${graph} svg'), r = svg.getBoundingClientRect()
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -300, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  })()`)
  const zoomed = await view()
  await settled()
  assert.equal(await view(), zoomed)
})

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

test('the entry collapsed or expanded stays where it is, in the view as it was zoomed', async () => {
  await open()
  await settled()
  // zoomed in about a point away from the entry, so the view is not the one a first drawing has
  await page.evaluate(`(() => {
    const svg = document.querySelector('${graph} svg'), r = svg.getBoundingClientRect()
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -300, clientX: r.x + r.width / 4, clientY: r.y + r.height / 4 }))
  })()`)
  await page.sleep(300)
  const zoomed = await view()
  const at = await centre(ENTRY)
  for (const action of ['Collapse Sinks', 'Expand Sinks', 'Collapse Sources', 'Expand Sources', 'double-click', 'double-click']) {
    const before = await drawn()
    if (action === 'double-click') await doubleClick()
    else await fromMenu(action)
    await page.waitFor(`JSON.stringify([...document.querySelectorAll('${graph} circle')].map((c) => c.__data__.name).sort()) !== ${q(q(before))}`, 10000)
    assert.ok(near(await centre(ENTRY), at), `${action}: the entry is where it was, drawn again`)
    await settled()
    assert.ok(near(await centre(ENTRY), at), `${action}: the entry is where it was, the graph settled`)
    assert.equal(await view(), zoomed, `${action}: the view is kept`)
  }
})

test('a double-click on an entry does not zoom the graph', async () => {
  const all = await open()
  await settled()
  const leaf = all.find((name) => family.own(name, 'sinks').length === 0)
  const before = await view()
  await doubleClick(leaf)
  // a double-click's zoom takes 250ms
  await page.sleep(600)
  assert.equal(await view(), before, `double-clicking ${leaf}`)
})

test('a source or sink on an entry\'s card opens its own card', async () => {
  await open()
  const [source] = family.own(ENTRY, 'sources')
  assert.ok(source, `${ENTRY} has a source`)
  // an entry's card opens on a click on its circle
  await page.evaluate(`${circle(ENTRY)}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  const title = `document.querySelector('.details-card-container .details-card h2')?.innerText.trim()`
  await page.waitFor(`${title} === ${q(ENTRY)}`, 15000)
  const link = `[...document.querySelectorAll('.details-card-container .relationship-item .rel-link')].find((b) => b.innerText.trim() === ${q(source)})`
  await page.waitFor(link, 15000)
  await page.evaluate(`${link}.click()`)
  await page.waitFor(`${title} === ${q(source)}`, 15000)
  // and back, from the source's sinks
  const back = `[...document.querySelectorAll('.details-card-container .relationship-item .rel-link')].find((b) => b.innerText.trim() === ${q(ENTRY)})`
  await page.waitFor(back, 15000)
  await page.evaluate(`${back}.click()`)
  await page.waitFor(`${title} === ${q(ENTRY)}`, 15000)
})
