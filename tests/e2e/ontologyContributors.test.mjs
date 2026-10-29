// The ontology's named contributors (breedgraph docs/person.md §6): a person chooses, on their profile, to be named among
// the contributors to the ontology versions their work is in, and anyone then sees them on the ontology page. On the
// test database the admin built and committed the ontology, and their account is linked to person_admin; no one is
// named until they choose to be. The admin chooses it, a visitor sees them named, and they stop again.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, flat, graphql, loginAs, logout } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

const q = JSON.stringify
const checkbox = `document.querySelector('.ontology-credit input[name=ontologyCredit]')`
const contributors = `document.querySelector('.ontology-contributors')`

let browser, page

const setCredit = (listed) => graphql(page, 'mutation ($listed: Boolean!) { peopleSetOntologyCredit(listed: $listed) { status } }', { listed })

before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  // a choice left by an interrupted run
  await loginAs(page, 'admin')
  await setCredit(false)
})
after(async () => {
  try {
    await loginAs(page, 'admin')
    await setCredit(false)
    await logout(page)
  } finally {
    await browser?.close()
  }
})

test('the admin chooses on their profile to be named among the ontology contributors, and a visitor sees them', async () => {
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`!!${checkbox}`, 30000)
  assert.equal(await page.evaluate(`${checkbox}.checked`), false, 'no one is named until they choose to be')
  assert.match(flat(await page.text('.ontology-credit')), /to anyone/)
  await page.evaluate(`${checkbox}.click()`)
  await page.waitFor(`document.querySelector('.profile-page')?.innerText.includes("named among the ontology's contributors")`, 15000)
  await page.waitFor(`${checkbox}.checked && !${checkbox}.disabled`, 15000)

  await logout(page)
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`${contributors}?.innerText.includes(${q(e.person_admin.name)})`, 30000)
  assert.match(flat(await page.text('.ontology-contributors')), /credited together/)
})

test('once they stop, the ontology page names no one', async () => {
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`${checkbox}?.checked`, 30000)
  await page.evaluate(`${checkbox}.click()`)
  await page.waitFor(`document.querySelector('.profile-page')?.innerText.includes("no longer named")`, 15000)

  await logout(page)
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`${contributors}?.innerText.includes('none named')`, 30000)
  assert.ok(!(await page.evaluate(`${contributors}.innerText.includes(${q(e.person_admin.name)})`)))
})
