// Everyone accepts the Terms of Use before using BreedGraph (breedgraph docs/licences.md §4): the app shows them in
// place of any page until then, but the Terms and the privacy notice themselves; the API refuses everything else, so
// nothing else is asked for meanwhile. Accepting loads the page again. A visitor's acceptance holds for a week and is
// carried over on signing in, so signing in and out asks again for neither. This browser does not accept the Terms
// by itself (acceptTerms: false), as the others do.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1400, acceptTerms: false }); page = browser.page })
after(async () => { await logout(page); await browser?.close() })

const termsState = () => page.evaluate(`document.querySelector('[data-terms]')?.dataset.terms ?? null`)

test('a first visit is shown the Terms of Use, and nothing else is asked of the API', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('[data-terms]')?.dataset.terms === 'asked'`, 30000)
  await page.waitFor(`document.querySelector('.terms-gate .terms-content h1')`, 15000)
  assert.equal(await page.text('.terms-gate .terms-content h1'), 'BreedGraph Terms of Use')
  assert.ok(!(await page.exists('.program-card')), 'no page is shown')
  assert.ok(await page.evaluate(`document.querySelector('.terms-gate button.accept').disabled`), 'Accept waits for the box to be ticked')
  assert.deepEqual(await page.graphqlErrors(mark), [], 'no request was refused')
  assert.deepEqual(page.graphql(mark).map((r) => r.op), ['termsOfUse'], 'only the Terms were read')
})

test('the Terms and the privacy notice can be read before accepting', async () => {
  await page.click('.app-footer a[href="/terms"]')
  await page.waitFor(`location.pathname === '/terms' && document.querySelector('.terms-page .terms-content h1')`, 15000)
  assert.ok(!(await page.exists('.terms-page .accepted-note')), 'not yet accepted')
  await page.click('.app-footer a[href="/privacy"]')
  await page.waitFor(`location.pathname === '/privacy' && document.querySelector('.privacy-content h1')`, 15000)
  assert.equal(await termsState(), 'asked')
})

test('accepting the Terms opens the page', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.terms-gate input[name=termsAgreed]')`, 30000)
  await page.check('.terms-gate input[name=termsAgreed]')
  await page.click('.terms-gate button.accept')
  await page.waitFor(`document.querySelector('[data-terms]')?.dataset.terms === 'accepted' && document.querySelector('.program-card')`, 30000)
  assert.ok(!(await page.exists('.terms-gate')))
  await page.goto(`${config.appUrl}/terms`)
  await page.waitFor(`document.querySelector('.terms-page .accepted-note')`, 15000)
})

test('signing in carries the acceptance over, and signing out and in again asks for nothing', async () => {
  await loginAs(page, 'outsider')
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.program-card')`, 30000)
  assert.equal(await termsState(), 'accepted')
  await logout(page)
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.program-card')`, 30000)
  assert.equal(await termsState(), 'accepted')
  await loginAs(page, 'outsider')
  assert.equal(await termsState(), 'accepted')
})
