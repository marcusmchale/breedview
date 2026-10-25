// Who wrote what, in the controller modal (breedgraph docs/read-access.md): accounts are shown only to their owner and
// admins of their teams, so a write is attributed to the writer's Person where the viewer cannot see the account, and
// a writer with neither is named as such. What the API returns (organisation roots, team placeholders, controllers
// refused anonymously, write attribution) is tested in breedgraph; here, the labels.
// The admin is linked to a Person released to registered users and wrote the public program; the writer has no Person
// and wrote the study.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, expandProgramsUntil, loginAs, logout, flat } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await logout(page); await browser?.close() })

const badgeOf = (card, name) => `[...document.querySelectorAll('.controller-badge')].find((b) => b.closest(${JSON.stringify(card)})
  ?.querySelector('h3, h4, strong')?.innerText.trim() === ${JSON.stringify(name)})`

async function openPrograms() {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.controller-badge:not([disabled])')`, 30000)
  await expandProgramsUntil(page, `document.body.innerText.includes(${JSON.stringify(e.study_public.name)})`)
  await page.waitFor(`!document.querySelector('.controller-badge[disabled]')`, 30000)
}
async function history(card, name) {
  await page.evaluate(`${badgeOf(card, name)}.click()`)
  await page.waitFor(`document.body.innerText.includes('Write History')`, 30000)
  const modal = flat(await page.text('.controller-modal'))
  await page.evaluate(`document.querySelector('.modal-close').click()`)
  return modal
}

test('a registered user sees writes attributed to the writer\'s Person, or to an account without one', async () => {
  await loginAs(page, 'outsider')
  await openPrograms()
  const program = await history('.program-card-header', e.program_public.name)
  assert.ok(program.includes(e.person_admin.name), `the admin's write is attributed to their Person: ${program}`)
  assert.ok(!program.includes(config.adminUser), 'not to their account')
  const study = await history('.study-card', e.study_public.name)
  assert.ok(study.includes('An account without a Person record'), `a writer with neither a visible account nor a Person: ${study}`)
  assert.ok(!study.includes('Unknown User'))
  await logout(page)
})

test('the admin sees their own account as the writer', async () => {
  await loginAs(page, 'admin')
  await openPrograms()
  const program = await history('.program-card-header', e.program_public.name)
  assert.ok(program.includes(config.adminUser), `the admin's own account: ${program}`)
  await logout(page)
})
