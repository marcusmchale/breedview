// Measure the blocks page on one field: listing its blocks, expanding the root, expanding the largest child.
// node tests/e2e/perf/blocks.mjs  (env: FIELD, by default the test database manifest's perf.field, plus the lib/app.mjs settings)
import { launchBrowser } from '../lib/browser.mjs'
import { config, login } from '../lib/app.mjs'
import { perf } from '../lib/fixture.mjs'

const FIELD = process.env.FIELD || perf.field
const browser = await launchBrowser()
const page = browser.page
try {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/blocks`)
  await page.waitFor(`document.querySelector('.regions-tree .location-node')`, 30000)
  await page.sleep(1000)
  for (let depth = 0; depth < 5; depth++) {
    if (await page.evaluate(`[...document.querySelectorAll('.location-name')].some((e) => e.innerText.trim() === ${JSON.stringify(FIELD)})`)) break
    await page.evaluate(`[...document.querySelectorAll('.location-node')].filter((n) => !n.querySelector('.expand-btn.expanded')).forEach((n) => n.querySelector(':scope > .location-header .expand-btn')?.click())`)
    await page.sleep(2500)
  }
  let mark = page.mark()
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(FIELD)}).click()`)
  const listMs = await page.waitFor(`document.querySelector('.blocks-list .block-item')`, 60000)
  console.log(`blocks of ${FIELD}: listed in ${listMs} ms`, JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) }))))
  await page.evaluate(`document.querySelector('.blocks-list .block-item').click()`)
  await page.waitFor(`document.querySelector('.unit-tree .node-header')`)
  await page.sleep(500)
  mark = page.mark()
  const heap0 = await page.heapMB()
  await page.evaluate(`document.querySelector('.unit-tree .node-header .expand-btn').click()`)
  const rootMs = await page.waitFor(`document.querySelectorAll('.unit-tree .node-header').length > 1 && !document.querySelector('.unit-tree .children .loading')`, 300000)
  await page.sleep(1500)
  const nodes = await page.evaluate(`document.querySelectorAll('.unit-tree .node-header').length`)
  const requests = page.graphql(mark)
  console.log(`expand root: ${rootMs} ms, ${nodes} nodes, ${requests.length} requests (${Math.round(requests.reduce((s, r) => s + r.bytes, 0) / 1024)} kB), heap ${heap0} -> ${await page.heapMB()} MB`)
  const [index, count] = await page.evaluate(`(() => { const hs = [...document.querySelectorAll('.unit-tree .children .node-header')]; let best = -1, max = 0; hs.forEach((h, i) => { const c = parseInt(h.querySelector('.count')?.innerText || '0'); if (c > max) { max = c; best = i } }); return [best, max] })()`)
  if (index >= 0) {
    mark = page.mark()
    await page.evaluate(`[...document.querySelectorAll('.unit-tree .children .node-header')][${index}].querySelector('.expand-btn').click()`)
    const childMs = await page.waitFor(`document.querySelectorAll('.unit-tree .node-header').length > ${nodes} && !document.querySelector('.unit-tree .children .children .loading')`, 600000)
    await page.sleep(1500)
    console.log(`expand largest child (${count} children): ${childMs} ms, ${await page.evaluate(`document.querySelectorAll('.unit-tree .node-header').length`)} nodes, ${page.graphql(mark).length} requests, heap ${await page.heapMB()} MB`)
  }
} finally {
  await browser.close()
}
