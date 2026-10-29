// How teams are credited (breedgraph README, Team): a team's attribution, shown to anyone with what it controls, which
// the teams below it take unless they set their own. On the test database, the root team is credited by its own
// attribution and the child team takes it (the manifest's teams and each entity's credit). A visitor sees the credit
// where a signed-in user sees the controller badge, on a public study, and in the study's datasets; a signed-in user
// sees it in the badge's title and the controller's details; and an admin gives the child team an attribution of its
// own in the team form, where the root's is the placeholder, and clears it again.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, expandProgramsUntil, flat, graphql, loginAs, logout } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const child = String(teams.child.id)
const OWN = 'E2E Wheat Group, Read Policy Institute'

let browser, page

// the child team back as the test database has it, without an attribution of its own
const clearChild = async () => {
  await loginAs(page, 'admin')
  await graphql(page, 'mutation ($team: TeamUpdate!) { teamsUpdateTeam(team: $team) { status } }', { team: { id: child, attribution: null } })
}

before(async () => { browser = await launchBrowser({ height: 2000 }); page = browser.page })
after(async () => {
  try {
    await clearChild()
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const studyCard = `[...document.querySelectorAll('.study-card')].find((c) => c.innerText.includes(${q(e.study_public.name)}))`
// a row's label and value, as one line of text, though they are laid out apart
const rowText = (element) => page.evaluate(`[...${element}.children].map((part) => part.innerText.trim()).join(' ')`)

test('a visitor sees whom to credit for a public study, and for its datasets', async () => {
  assert.ok(e.study_public.credit && e.dataset_public.credit, 'the manifest has the credit (rebuild the test database)')
  await page.goto(`${config.appUrl}/programs`)
  await expandProgramsUntil(page, `${studyCard}?.querySelector('.credit-line')`)
  assert.equal(flat(await page.evaluate(`${studyCard}.querySelector('.credit-line').innerText`)), `Credit: ${e.study_public.credit}`)
  assert.ok(!(await page.exists('.controller-badge')), 'no controller badges')

  await page.evaluate(`[...${studyCard}.querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click()`)
  await page.waitFor(`${studyCard}.querySelector('.dataset-header')`, 30000)
  await page.evaluate(`${studyCard}.querySelectorAll('.dataset-header').forEach((h) => h.click())`)
  await page.waitFor(`${studyCard}.querySelector('.dataset-credit')`, 30000)
  assert.equal(await rowText(`${studyCard}.querySelector('.dataset-credit')`), `Credit: ${e.dataset_public.credit}`)
})

test('a signed-in user sees the credit with the controls', async () => {
  await loginAs(page, 'writer')
  await page.goto(`${config.appUrl}/programs`)
  const badge = `${studyCard}?.querySelector('.controller-badge:not([disabled])')`
  await expandProgramsUntil(page, `${badge}?.title.includes('Credit')`)
  assert.match(await page.evaluate(`${badge}.title`), new RegExp(`^Credit: ${e.study_public.credit}\\.`))
  assert.ok(!(await page.evaluate(`!!${studyCard}.querySelector('.credit-line')`)), 'the badge, not the line')

  await page.evaluate(`${badge}.click()`)
  await page.waitFor(`document.querySelector('.controller-modal .controller-credit')`, 30000)
  assert.equal(await rowText(`document.querySelector('.controller-modal .controller-credit')`), `Credit: ${e.study_public.credit}`)
})

// A team's node under Teams, by its id
const teamNode = (id) => `[...document.querySelectorAll('.team-node')].find((n) => n.querySelector('.team-meta p')?.innerText.trim() === ${q(`ID: ${id}`)})`
const credit = (id) => `(${teamNode(id)})?.querySelector('.team-credit')?.innerText.trim()`

test('an admin gives the team below its own attribution, with the one it inherits as the placeholder, and clears it', async () => {
  await clearChild()
  await page.goto(`${config.appUrl}/access`)
  const root = String(teams.root.id)
  await page.waitFor(`!!(${teamNode(root)})?.querySelector('.expand-button')`, 30000)
  assert.equal(flat(await page.evaluate(credit(root))), `Credit: ${teams.root.attribution}`)
  await page.evaluate(`(${teamNode(root)}).querySelector('.expand-button').click()`)
  await page.waitFor(`!!(${teamNode(child)})`, 30000)
  assert.equal(flat(await page.evaluate(credit(child))), `Credit: ${teams.root.attribution} (from the team above)`)

  const edit = async () => {
    await page.evaluate(`[...(${teamNode(child)}).querySelectorAll('.team-actions button')].find((b) => b.innerText.includes('Edit Team')).click()`)
    await page.waitFor(`document.querySelector('.edit-team-modal .attribution-field input')`)
  }
  await edit()
  assert.equal(await page.evaluate(`document.querySelector('.edit-team-modal .attribution-field input').placeholder`),
    `${teams.root.attribution} (from the team above)`)
  assert.match(flat(await page.text('.edit-team-modal .attribution-field')), /It is public/)
  await page.type('.edit-team-modal .attribution-field input', OWN)
  await page.click('.edit-team-modal form button[type=submit]')
  await page.waitFor(`${credit(child)} === ${q(`Credit: ${OWN}`)}`, 15000)

  await edit()
  assert.equal(await page.evaluate(`document.querySelector('.edit-team-modal .attribution-field input').value`), OWN)
  await page.type('.edit-team-modal .attribution-field input', '')
  await page.click('.edit-team-modal form button[type=submit]')
  await page.waitFor(`${credit(child)}?.includes('(from the team above)')`, 15000)
})
