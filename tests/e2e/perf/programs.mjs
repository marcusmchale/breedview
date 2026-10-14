// Measure the study summaries on the programs page: expand every program's trials, every trial's studies and every
// study's datasets section, then time the summaries requests and how long until every panel has its summary.
// node tests/e2e/perf/programs.mjs  (env: the lib/app.mjs settings)
import { launchBrowser } from '../lib/browser.mjs'
import { config, login } from '../lib/app.mjs'

const browser = await launchBrowser()
const page = browser.page
try {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.program-card')`, 30000)
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.trials-header').forEach((e) => e.click())`)
  await page.waitFor(`document.querySelector('.trial-card .studies-header')`, 30000)
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.studies-header').forEach((e) => e.click())`)
  await page.waitFor(`document.querySelectorAll('.study-card').length > 0 && [...document.querySelectorAll('.study-card')].every((c) => c.querySelector('.section-toggle'))`, 30000)
  await page.sleep(1000)
  const mark = page.mark()
  await page.evaluate(`document.querySelectorAll('.study-card').forEach((c) => [...c.querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click())`)
  const readyMs = await page.waitFor(
    `[...document.querySelectorAll('.study-card')].length > 0 && [...document.querySelectorAll('.study-card')].every((c) => c.querySelector('.study-summary') && !c.querySelector('.study-summary').innerText.startsWith('Loading'))`,
    300000
  )
  const requests = page.graphql(mark)
  const summaries = requests.filter((r) => r.op === 'StudyDatasetsSummaries')
  const ms = summaries.map((r) => r.ms).sort((a, b) => a - b)
  console.log(`${await page.evaluate(`document.querySelectorAll('.study-summary').length`)} study summaries ready after ${readyMs} ms`)
  console.log(`${summaries.length} StudyDatasetsSummaries requests: median ${ms[Math.floor(ms.length / 2)]} ms, max ${ms[ms.length - 1]} ms, ${Math.round(summaries.reduce((s, r) => s + r.bytes, 0) / 1024)} kB`)
  console.log('other requests:', JSON.stringify(requests.filter((r) => r.op !== 'StudyDatasetsSummaries').map((r) => [r.op, r.ms])))
  console.log('panels:', JSON.stringify(await page.evaluate(
    `[...document.querySelectorAll('.study-card')].map((c) => c.querySelector('strong').innerText + ': ' + c.querySelector('.study-summary').innerText.replace(/\\n+/g, ' | ').slice(0, 160))`
  ), null, 1))
} finally {
  await browser.close()
}
