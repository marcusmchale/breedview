// Measure loading one concept of one study in the curation table: API time, rows rendered, heap, then the next page.
// node tests/e2e/perf/curation.mjs  (env: STUDY and CONCEPT, by default the test database manifest's perf, PAGE_SIZE (units per page; default: the app's, 250) START="" END="" UNIT="",
// plus the lib/app.mjs settings). START and END narrow the records to a time window, and UNIT to the first block
// whose name includes it, before loading.
import { launchBrowser } from '../lib/browser.mjs'
import { config, login } from '../lib/app.mjs'
import { perf } from '../lib/fixture.mjs'

const STUDY = process.env.STUDY || perf.study
const CONCEPT = process.env.CONCEPT || perf.concept
const PAGE_SIZE = process.env.PAGE_SIZE || ''
const START = process.env.START || ''
const END = process.env.END || ''
const UNIT = process.env.UNIT || ''

// FormKit masks non-string option values, so pick a select's option by its text
const selectText = (selector, text) => page.evaluate(`(() => {
  const s = document.querySelector(${JSON.stringify(selector)}); const i = [...s.options].findIndex((o) => o.text.trim() === ${JSON.stringify(text)});
  if (i < 0) throw new Error('no option ' + ${JSON.stringify(text)}); s.selectedIndex = i;
  s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
const browser = await launchBrowser()
const page = browser.page
try {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await page.sleep(1000)
  // walk program -> trial -> study, taking the first entry at each level unless it matches STUDY
  for (let level = 0; level < 3; level++) {
    const labels = await page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.trim())`)
    if (!(await page.exists('.options-list .expand-button'))) break
    const pick = Math.max(labels.findIndex((l) => l.includes(STUDY)), 0)
    await page.evaluate(`[...document.querySelectorAll('.options-list .expand-button')][${pick}].click()`)
    await page.sleep(1500)
  }
  const labels = await page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.trim())`)
  const pick = Math.max(labels.findIndex((l) => l.includes(STUDY)), 0)
  let mark = page.mark()
  await page.evaluate(`[...document.querySelectorAll('.options-list .option-checkbox')][${pick}].click()`)
  await page.sleep(300)
  await page.evaluate(`document.querySelector('.btn-done').click()`)
  const summariesMs = await page.waitFor(`document.querySelector('select[name=conceptIds] option')`, 120000)
  console.log(`study ${labels[pick]}: summaries in ${summariesMs} ms`, JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) }))))
  await page.evaluate(`(() => { const s = document.querySelector('select[name=conceptIds]'); [...s.options].forEach((o) => { o.selected = o.text.trim() === ${JSON.stringify(CONCEPT)} }); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(300)
  // the record filters appear once datasets are selected
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`)
  console.log('selection:', (await page.text('.datasets-hint'))?.trim())
  if (PAGE_SIZE) await selectText('.record-filters select[name=pageSize]', Number(PAGE_SIZE).toLocaleString())
  if (START) await page.type('.record-filters input[name=start]', START)
  if (END) await page.type('.record-filters input[name=end]', END)
  if (UNIT) {
    await page.evaluate(`document.querySelector('.record-filters .hierarchical-multiselect .select-trigger').click()`)
    await page.waitFor(`document.querySelector('.options-list .option-label')`)
    const blocks = await page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.trim())`)
    const pick = blocks.findIndex((l) => l.includes(UNIT))
    if (pick < 0) throw new Error(`no block including "${UNIT}" among ${blocks.join(', ')}`)
    await page.evaluate(`[...document.querySelectorAll('.options-list .option-checkbox')][${pick}].click()`)
    await page.sleep(300)
    await page.evaluate(`document.querySelector('.btn-done').click()`)
    console.log(`unit filter: ${blocks[pick]}`)
  }
  await page.sleep(300)
  mark = page.mark()
  const heapBefore = await page.heapMB()
  await page.evaluate(`[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table')).click()`)
  const rowsMs = await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 600000)
  await page.sleep(2000)
  const rows = await page.evaluate(`document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)').length`)
  const total = await page.evaluate(`document.querySelector('.section-header')?.innerText ?? ''`)
  console.log(`concept ${CONCEPT}: first rows after ${rowsMs} ms; ${rows} rows in the DOM ${total ? `(${total.trim()})` : ''}; heap ${heapBefore} -> ${await page.heapMB()} MB`)
  console.log('requests:', JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) }))))
  console.log('paging:', (await page.text('.toolbar .paging'))?.replace(/\s+/g, ' ').trim())
  // the next page, when there is one
  const next = await page.evaluate(`(() => { const b = [...document.querySelectorAll('.toolbar .paging button')].find((e) => e.innerText.includes('Next')); return b ? !b.disabled : false })()`)
  if (next) {
    mark = page.mark()
    await page.evaluate(`[...document.querySelectorAll('.toolbar .paging button')].find((e) => e.innerText.includes('Next')).click()`)
    await page.waitFor(`!document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 60000)
    const nextMs = await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 600000)
    await page.sleep(1000)
    console.log(`next page: rows after ${nextMs} ms; ${(await page.text('.toolbar .paging'))?.replace(/\s+/g, ' ').trim()}; heap ${await page.heapMB()} MB`)
    console.log('requests:', JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) }))))
  }
} finally {
  await browser.close()
}
