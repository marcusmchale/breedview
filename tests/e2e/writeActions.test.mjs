// Write actions are offered only where the backend would allow them: creating needs a write affiliation to some
// team, and changing, removing or adding to an entity needs curate access to a team that controls it. The test
// database's admin writes and curates for the organisation (root) but only administers the team below it (child),
// which controls the private program: so it can create programs and edit the organisation's, but not edit the child
// team's until curate access is granted for the test.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const CHILD = String(teams.child.id)
let browser, page, userId, granted = false

const pageActions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /^(Create|Edit|Delete)/.test(t))`)
// the actions of a program's card; the program is found by its name, or as the placeholder
const actionsOf = (name) => page.evaluate(`[...[...document.querySelectorAll('.program-card')]
  .find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${JSON.stringify(name)})
  .querySelectorAll('button')].map((e) => e.innerText.trim()).filter((t) => /^(Create|Edit|Delete)/.test(t))`)

async function openPrograms() {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.program-card-header h3')`, 30000)
  // the controller's teams decide the actions; give the badge's query time to return
  await page.waitFor(`!document.querySelector('.controller-badge[disabled]')`, 30000)
  await page.sleep(1000)
}

const curateTeams = async () =>
  (await graphql(page, 'query { accountsUserAccess { result { curate { id } } } }')).result.curate.map((t) => t.id)

before(async () => {
  browser = await launchBrowser(); page = browser.page
  await loginAs(page, 'admin')
  userId = (await graphql(page, 'query { accountsAccount { result { user { id } } } }')).result.user.id
})
after(async () => {
  try {
    if (granted) {
      await graphql(page, `mutation ($team: ID!) { accountsRemoveAffiliation(teamId: $team, access: CURATE) { status } }`, { team: CHILD })
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

test('a writer can create a program, and change those of the teams they curate only', async () => {
  assert.ok(!(await curateTeams()).includes(CHILD), `the admin does not curate ${teams.child.name}`)
  await openPrograms()
  assert.ok((await pageActions()).includes('Create New Program'))
  assert.ok((await actionsOf(e.program_public.name)).includes('Edit'), 'the organisation\'s program can be changed')
  assert.ok(!(await actionsOf(e.program.name)).some((a) => /^(Edit|Delete|Create Trial)/.test(a)), 'the child team\'s cannot')
})

test('with curate access to the controlling team, the program can be changed and added to', async () => {
  const payload = await graphql(page, `mutation ($user: ID!, $team: ID!) {
    accountsApproveAffiliation(userId: $user, teamId: $team, access: CURATE, heritable: false) { status errors { message } } }`,
  { user: userId, team: CHILD })
  assert.equal(payload.status, 'SUCCESS', JSON.stringify(payload.errors))
  granted = true
  await openPrograms()
  const offered = await actionsOf(e.program.name)
  for (const action of ['Create Trial', 'Edit']) assert.ok(offered.includes(action), `${action} is offered: ${offered}`)
})
