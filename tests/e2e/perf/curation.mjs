// Measure loading one concept of one study in the curation table: API time, rows rendered, heap.
// node tests/e2e/perf/curation.mjs  (env: STUDY="Study B" CONCEPT="Variable A", plus the lib/app.mjs settings)
import { launchBrowser } from '../lib/browser.mjs'
import { config, login } from '../lib/app.mjs'

const STUDY = process.env.STUDY || 'Study B'
const CONCEPT = process.env.CONCEPT || 'Variable A'
const browser = await launchBrowser()
const page = browser.page
try {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/datasets`)
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
  mark = page.mark()
  const heapBefore = await page.heapMB()
  await page.evaluate(`[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table')).click()`)
  const rowsMs = await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 600000)
  await page.sleep(2000)
  const rows = await page.evaluate(`document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)').length`)
  const total = await page.evaluate(`document.querySelector('.section-header')?.innerText ?? ''`)
  console.log(`concept ${CONCEPT}: first rows after ${rowsMs} ms; ${rows} rows in the DOM ${total ? `(${total.trim()})` : ''}; heap ${heapBefore} -> ${await page.heapMB()} MB`)
  console.log('requests:', JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) }))))
} finally {
  await browser.close()
}
