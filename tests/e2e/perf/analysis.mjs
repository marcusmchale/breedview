// Measure selecting the datasets of one concept of one study in the analysis editor: the requests, what they
// carry and the heap, then a time binning suggestion from the dataset dimensions.
// node tests/e2e/perf/analysis.mjs  (env: STUDY and CONCEPT, by default the test database manifest's perf, plus the lib/app.mjs settings)
import { launchBrowser } from '../lib/browser.mjs'
import { config, login } from '../lib/app.mjs'
import { perf } from '../lib/fixture.mjs'

const STUDY = process.env.STUDY || perf.study
const CONCEPT = process.env.CONCEPT || perf.concept

const requests = (mark) => JSON.stringify(page.graphql(mark).map((r) => ({ op: r.op, ms: r.ms, kB: Math.round(r.bytes / 1024) })))
const browser = await launchBrowser()
const page = browser.page
try {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  // walk program -> trial -> study in the studies picker, taking the first entry at each level unless it matches STUDY
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.sleep(1000)
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
  const summariesMs = await page.waitFor(`document.querySelector('#analysis-data .dataset-row input')`, 120000)
  console.log(`study ${labels[pick]}: datasets listed in ${summariesMs} ms`, requests(mark))
  // select the datasets of the concept
  const rows = await page.evaluate(`[...document.querySelectorAll('#analysis-data .dataset-row')].map((e) => e.innerText.trim())`)
  const picks = rows.map((text, i) => (text.includes(CONCEPT) ? i : -1)).filter((i) => i >= 0)
  if (picks.length === 0) throw new Error(`no dataset of ${CONCEPT} among ${rows.length} rows`)
  mark = page.mark()
  const heapBefore = await page.heapMB()
  for (const i of picks) {
    await page.evaluate(`[...document.querySelectorAll('#analysis-data .dataset-row input')][${i}].click()`)
    await page.sleep(100)
  }
  // the concept select of the terms section lists the concepts once the datasets have loaded
  const loadedMs = await page.waitFor(`[...document.querySelectorAll('#analysis-terms select option')].some((o) => o.text.includes(${JSON.stringify(CONCEPT)}))`, 600000)
  await page.sleep(1500)
  console.log(`concept ${CONCEPT}: ${picks.length} datasets selected, ready after ${loadedMs} ms; heap ${heapBefore} -> ${await page.heapMB()} MB`)
  console.log('requests:', requests(mark))
  // time grouping: suggest boundaries by year from the dataset dimensions
  await page.evaluate(`[...document.querySelectorAll('#analysis-grouping .box')].find((b) => b.innerText.includes('Time')).querySelector('.toggle input').click()`)
  await page.waitFor(`document.querySelector('#analysis-grouping .binning-editor')`)
  const canSuggest = await page.exists('#analysis-grouping .binning-editor .suggest button')
  if (canSuggest) {
    await page.evaluate(`document.querySelector('#analysis-grouping .binning-editor .suggest button').click()`)
    await page.sleep(300)
    const bounds = await page.evaluate(`[...document.querySelectorAll('#analysis-grouping .binning-editor table.bins tbody tr')].map((r) => [...r.querySelectorAll('input')].map((i) => i.value).join(' | '))`)
    console.log('time bins by year:', JSON.stringify(bounds))
  } else {
    console.log('time bins: no suggestion available (no record times)')
  }
} finally {
  await browser.close()
}
