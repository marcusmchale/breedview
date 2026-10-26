// The guide as a static site (guide/README.md, The guide on GitHub Pages), served as Pages serves it: with
// GUIDE_SITE_URL its address, e.g. http://localhost:8086/breedview after npm run guide:site, the folder served with no
// fallback to the page; skipped without it. The site's root opens the contents, a chapter opens at its own address with
// its video and steps, its links stay within the site, and it contacts nothing else.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import { launchBrowser } from './lib/browser.mjs'

const SITE = process.env.GUIDE_SITE_URL?.replace(/\/$/, '')
const skip = SITE ? false : 'GUIDE_SITE_URL is not set: serve dist-guide and give its address'
const BASE = SITE ? new URL(SITE).pathname : ''
const CHAPTERS = readdirSync(new URL('../../src/guide/chapters/', import.meta.url)).filter((name) => name.endsWith('.md')).length

let browser, page
before(async () => { if (!skip) { browser = await launchBrowser({ acceptTerms: false }); page = browser.page } })
after(async () => { await browser?.close() })

test("the site's root opens the contents, every chapter listed", { skip }, async () => {
  const mark = page.mark()
  await page.goto(`${SITE}/`)
  await page.waitFor(`document.querySelector('.chapter-list a')`, 30000)
  assert.equal(await page.evaluate('location.pathname'), `${BASE}/guide`)
  assert.equal(await page.evaluate(`document.querySelectorAll('.chapter-list > li > a').length`), CHAPTERS)
  assert.deepEqual(page.consoleErrors(mark), [])
})

test('a chapter opens at its own address, its video and links within the site', { skip }, async () => {
  const mark = page.mark()
  const response = await fetch(`${SITE}/guide/joining/`)
  assert.equal(response.status, 200, 'a page of its own, not the site\'s 404')
  assert.match(await response.text(), /<title>Joining BreedGraph - BreedView user guide<\/title>/)
  await page.goto(`${SITE}/guide/joining/`)
  await page.waitFor(`document.querySelector('.guide-steps li') && document.querySelector('.guide-video video, .guide-video .missing')`, 30000)
  assert.equal(await page.text('main h1'), 'Joining BreedGraph')
  const links = await page.evaluate(`[...document.querySelectorAll('.guide-text a')].map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('http'))`)
  assert.ok(links.length && links.every((href) => href.startsWith(`${BASE}/guide/`)), JSON.stringify(links))
  assert.deepEqual(page.consoleErrors(mark), [])
  assert.deepEqual(page.origins(mark), [new URL(SITE).origin], 'nothing else is contacted')
})
