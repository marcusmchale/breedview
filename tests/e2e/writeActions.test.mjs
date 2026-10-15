// Write actions are offered only where the backend would allow them: creating needs a write affiliation to some
// team, and changing, removing or adding to an entity needs curate access to a team that controls it. The admin
// account writes for the Galway organisation but does not curate the "Hidden Team" team (id 2) that controls
// the migrated programs, so it can create a program but not edit one, until curate access is granted for the test.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql } from './lib/app.mjs'

const MIGRATION_TEAM = process.env.E2E_CURATE_TEAM || '2'
let browser, page, userId, granted = false

const actions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /^(Create|Edit|Delete)/.test(t))`)

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
  await login(page, config.adminUser, config.adminPassword)
  userId = (await graphql(page, 'query { accountsAccount { result { user { id } } } }')).result.user.id
})
after(async () => {
  try {
    if (granted) {
      await graphql(page, `mutation ($team: ID!) { accountsRemoveAffiliation(teamId: $team, access: CURATE) { status } }`, { team: MIGRATION_TEAM })
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

test('without curate access, a writer can create a program but not change one', async () => {
  assert.ok(!(await curateTeams()).includes(MIGRATION_TEAM), `the admin account does not curate team ${MIGRATION_TEAM}`)
  await openPrograms()
  assert.deepEqual(await actions(), ['Create New Program'])
})

test('with curate access to the controlling team, the program can be changed and added to', async () => {
  const payload = await graphql(page, `mutation ($user: ID!, $team: ID!) {
    accountsApproveAffiliation(userId: $user, teamId: $team, access: CURATE, heritable: false) { status errors { message } } }`,
  { user: userId, team: MIGRATION_TEAM })
  assert.equal(payload.status, 'SUCCESS', JSON.stringify(payload.errors))
  granted = true
  await openPrograms()
  const offered = await actions()
  for (const action of ['Create New Program', 'Create Trial', 'Edit']) assert.ok(offered.includes(action), `${action} is offered: ${offered}`)
})
