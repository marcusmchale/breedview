// Accounts and organisations under the read policy (breedgraph docs/read-access.md): organisation roots and their
// legal entities are public, other teams are seen by those affiliated with them, and a hidden team asked for by id is
// a placeholder. Accounts are shown only to their owner and admins of their teams, so what an account did (a write)
// is attributed to its Person, under the people policy. lib/partialAccess.mjs links the admin to a public Person.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql, flat } from './lib/app.mjs'
import { ensureAdminPerson, adminPersonName, loginPartial, people, names } from './lib/partialAccess.mjs'

const HIDDEN_TEAM = 2       // Hidden Team, below Galway
const ADMIN_GERMPLASM = 1   // Taxon A, public, recorded by the admin

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await ensureAdminPerson(page)
  await page.goto(`${config.appUrl}/login`)
  // signed out for good before the anonymous checks: navigating straight after logging out can cut the logout short
  const signedOut = async () => (await graphql(page, 'query { accountsAccount { status } }')).status === 'ERROR'
  for (let attempt = 0; attempt < 10 && !(await signedOut()); attempt++) await page.sleep(500)
})
after(async () => { await logout(page); await browser?.close() })

const organisations = async () => (await graphql(page, `query { organisations { result { id name children { id }
  legalEntity { legalName privacyContact declaredBy { id } } } } }`)).result
const teamById = async (id) => (await graphql(page, `query ($id: ID!) { organisationsTeam(id: $id) { result { id name parent { id } } } }`, { id })).result
const lastWrite = async () => (await graphql(page, `query ($ids: [ID!]!) { controlsControllers(entityLabel: GERMPLASM, entityIds: $ids) {
  result { writes(last: 1) { user { name } person { name restricted } } } } }`, { ids: [ADMIN_GERMPLASM] })).result[0].writes[0]

test('anonymous: organisation roots and their legal entities, not their teams', async () => {
  const roots = await organisations()
  const galway = roots.find((o) => o.name === names.organisation)
  assert.ok(galway?.legalEntity?.legalName, 'the data controller is public')
  assert.deepEqual([galway.children, galway.legalEntity.declaredBy], [[], null], 'but not its teams, nor who declared it')
  assert.deepEqual(await teamById(HIDDEN_TEAM), { id: String(HIDDEN_TEAM), name: 'REDACTED', parent: null }, 'a hidden team by id is a placeholder')
  const controllers = await graphql(page, `query { controlsControllers(entityLabel: GERMPLASM, entityIds: [1]) { status } }`)
  assert.equal(controllers.status, 'ERROR', 'controllers are for signed-in users')
})

test('a registered user sees writes attributed to the writer\'s Person, not the account', async () => {
  await loginPartial(page)
  assert.deepEqual(await lastWrite(), { user: null, person: { name: adminPersonName, restricted: false } })
  assert.deepEqual(await teamById(HIDDEN_TEAM), { id: String(HIDDEN_TEAM), name: 'REDACTED', parent: null })
  // a write by an account without a Person, on the public Study A study
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.controller-badge:not([disabled])')`, 30000)
  for (let level = 0; level < 2; level++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.evaluate(`[...document.querySelectorAll('.controller-badge')].at(-1).click()`)
  await page.waitFor(`document.body.innerText.includes('Write History')`, 30000)
  const modal = flat(await page.text('body'))
  assert.ok(modal.includes('An account without a Person record'), 'a writer with neither a visible account nor a Person')
  assert.ok(!modal.includes('Unknown User'))
  await page.evaluate(`document.querySelector('.modal-close').click()`)
  await logout(page)
})

test('the admin sees its own account, the hidden team, and its organisation\'s teams', async () => {
  await login(page, config.adminUser, config.adminPassword)
  const write = await lastWrite()
  assert.equal(write.user?.name, config.adminUser)
  assert.equal(write.person?.name, adminPersonName)
  const galway = (await organisations()).find((o) => o.name === names.organisation)
  assert.ok(galway.children.some((c) => Number(c.id) === HIDDEN_TEAM), 'the migration team below Galway')
  assert.equal((await teamById(HIDDEN_TEAM)).name, 'Hidden Team')
})
