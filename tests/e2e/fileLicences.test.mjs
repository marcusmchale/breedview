// A data file cited only by a dataset the reader can't see still holds that dataset's data (breedgraph
// docs/licences.md §5; the licence scenario's privately cited file, manifest `licences.privately_cited_file`; skipped
// without it). The outsider reads the registered licensed study and the file it lists among its references, but not
// the private dataset citing it: the file's download button asks for the study's licence first, and gives the link
// once it is accepted. The writer, whose team owns the file, gets the link without being asked.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'
import { licences as l } from './lib/fixture.mjs'

const skip = l?.privately_cited_file ? false : 'the test database manifest has no privately cited file: build it again (breedgraph docs/test-databases.md)'
const q = JSON.stringify

let browser, page, viewer = null
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page })
after(async () => {
  try {
    if (viewer) await logout(page)
  } finally {
    await browser?.close()
  }
})

async function signInAs(next) {
  if (viewer === next) return
  if (viewer) await logout(page)
  await loginAs(page, next)
  viewer = next
}

// opens a closed expansion header (they toggle) in the card
const openHeader = (card, header) => page.evaluate(`(() => {
  const h = ${card}.querySelector(${q(header)})
  if (h.querySelector('.expand-icon').innerText.includes('►')) h.click()
})()`)

// the file's row among the study's references, with its download button
async function openFileReference() {
  const study = l.studies[l.privately_cited_file.study]
  await page.goto(`${config.appUrl}/programs`)
  const program = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(l.program.name)})`
  await page.waitFor(`${program}?.querySelector('.trials-header')`, 30000)
  await openHeader(program, '.trials-header')
  const trial = `[...${program}.querySelectorAll('.trial-card')].find((c) => c.innerText.includes(${q(l.trial.name)}))`
  await page.waitFor(`${trial}?.querySelector('.studies-header')`, 30000)
  await openHeader(trial, '.studies-header')
  const card = `[...${trial}.querySelectorAll('.study-card')].find((c) => c.innerText.includes(${q(study.name)}))`
  await page.waitFor(`${card}?.querySelector('.references-display .references-header')`, 30000)
  await openHeader(card, '.references-display .references-header')
  const item = `[...${card}.querySelectorAll('.references-display .reference-item, .references-display .reference-header')].find((r) => r.innerText.includes(${q(l.privately_cited_file.name)}))`
  await page.waitFor(`${item}?.querySelector('.download-btn')`, 30000)
  return item
}

test('the outsider accepts the licence of data they cannot see before downloading its file', { skip }, async () => {
  await signInAs('outsider')
  const item = await openFileReference()
  await page.evaluate(`${item}.querySelector('.download-btn').click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .file-licence-agreement')`, 30000)
  const licenceName = l.studies[l.privately_cited_file.study].licence.name
  const titles = await page.evaluate(`[...document.querySelectorAll('.file-licence-agreement .licence-title')].map((t) => t.innerText.trim())`)
  assert.deepEqual(titles, [licenceName])
  assert.equal(await page.evaluate(`document.querySelector('.file-licence-agreement .accept-licences').disabled`), true,
    'accepted only once the box is ticked')
  await page.click('.file-licence-agreement input[name=fileLicencesAgreed]')
  await page.waitFor(`!document.querySelector('.file-licence-agreement .accept-licences').disabled`, 10000)
  await page.click('.file-licence-agreement .accept-licences')
  // accepted, the download goes on: the link comes, and nothing is asked again
  await page.waitFor(`!document.querySelector('.modal-overlay .file-licence-agreement') && ${item}.querySelector('a.download-btn')?.href`, 30000)
  assert.match(await page.evaluate(`${item}.querySelector('a.download-btn').href`), /download\?token=/)
})

test('the writer, whose team owns the file, gets its link without being asked', { skip }, async () => {
  await signInAs('writer')
  const item = await openFileReference()
  await page.evaluate(`${item}.querySelector('.download-btn').click()`)
  await page.waitFor(`document.querySelector('.modal-overlay .file-licence-agreement') || ${item}.querySelector('a.download-btn')?.href`, 30000)
  assert.equal(await page.evaluate(`!!document.querySelector('.modal-overlay .file-licence-agreement')`), false)
})
