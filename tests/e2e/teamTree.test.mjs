// The team tree under Teams, on Access control, shows what is done from it at once, without reloading the page: an
// affiliation the admin sets for themselves on the team below the organisation, one the outsider asks for to the
// organisation, and a team the admin makes below the team below, which they then delete. The affiliations are removed
// again, leaving the accounts and teams as the test database has them.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, flat, uniqueName } from './lib/app.mjs'
import { teams } from './lib/fixture.mjs'

const q = JSON.stringify
const root = String(teams.root.id)
const child = String(teams.child.id)
const TEAM_PREFIX = 'E2E tree team '
const newTeam = uniqueName(TEAM_PREFIX)

let browser, page

// The user signed in removes their affiliation to a team, if they have one
const removeAffiliation = (team, access) => graphql(page,
  `mutation ($team: ID!) { accountsRemoveAffiliation(teamId: $team, access: ${access}) { status } }`, { team })
const cleanUp = async () => {
  await loginAs(page, 'admin')
  await removeAffiliation(child, 'CURATE')
  const below = await graphql(page, 'query ($team: ID!) { teamsTeams(ids: [$team]) { result { children { id name } } } }', { team: child })
  for (const team of (below.result?.[0]?.children ?? []).filter((t) => t.name.startsWith(TEAM_PREFIX))) {
    await graphql(page, 'mutation ($team: ID!) { teamsDeleteTeam(id: $team) { status } }', { team: team.id })
  }
  await loginAs(page, 'outsider')
  await removeAffiliation(root, 'READ')
  await logout(page)
}

before(async () => {
  browser = await launchBrowser(); page = browser.page
  // an affiliation left by an interrupted run would leave nothing to set, and a team left would be in the way
  await cleanUp()
})
after(async () => {
  try {
    await cleanUp()
  } finally {
    await browser?.close()
  }
})

// A team's node under Teams, by its id, and its own badge for an access (R, W, C or A, + when heritable)
const teamNode = (id) => `[...document.querySelectorAll('.team-node')].find((n) => n.querySelector('.team-meta p')?.innerText.trim() === ${q(`ID: ${id}`)})`
const badge = (id, text) => `[...(${teamNode(id)})?.querySelector('.affiliation-badges').querySelectorAll('.badge') ?? []].find((b) => b.innerText.trim() === ${q(text)})`
const clickAction = (id, label) => page.evaluate(`[...(${teamNode(id)}).querySelectorAll('.team-actions button')].find((b) => b.innerText.includes(${q(label)})).click()`)

// Asks in the open affiliation modal for an access, and waits for the answer
const askFor = async (access) => {
  await page.waitFor(`document.querySelector('.modal select')`)
  await page.type('.modal select', access)
  await page.click('.modal form button[type=submit]')
  await page.waitFor(`document.querySelector('.modal .success-message, .modal .error-message')`, 15000)
  assert.match(flat(await page.text('.modal')), /Affiliation requested/, 'the affiliation is made')
}

test('an affiliation the admin sets on the team below the organisation shows on it at once', async () => {
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${teamNode(root)})?.querySelector('.expand-button')`, 30000)
  await page.evaluate(`(${teamNode(root)}).querySelector('.expand-button').click()`)
  await page.waitFor(`!!(${teamNode(child)})`, 30000)
  assert.ok(!(await page.evaluate(`!!(${badge(child, 'C')})`)), 'no curate access to the team below yet')

  await clickAction(child, 'Set Affiliation')
  await askFor('CURATE')
  await page.waitFor(`!!(${badge(child, 'C')})`, 10000)
})

test('an affiliation the outsider asks for to the organisation shows on it at once, as requested', async () => {
  await loginAs(page, 'outsider')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${teamNode(root)})`, 30000)
  assert.ok(!(await page.evaluate(`!!(${badge(root, 'R')})`)), 'no read access to the organisation yet')

  await clickAction(root, 'Request Affiliation')
  await askFor('READ')
  await page.waitFor(`!!(${badge(root, 'R')})`, 10000)
  assert.ok(await page.evaluate(`(${badge(root, 'R')}).classList.contains('badge-pending')`), 'shown as waiting for approval')
})

test('a team the admin makes below the team below shows there at once, and goes once deleted', async () => {
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${teamNode(root)})?.querySelector('.expand-button')`, 30000)
  await page.evaluate(`(${teamNode(root)}).querySelector('.expand-button').click()`)
  await page.waitFor(`!!(${teamNode(child)})`, 30000)

  await clickAction(child, 'Create Team')
  await page.waitFor(`document.querySelector('.modal input')`)
  await page.type('.modal input', newTeam)
  await page.click('.modal form button[type=submit]')
  const made = `[...(${teamNode(child)}).querySelectorAll('.team-node h3')].find((h) => h.innerText.trim() === ${q(newTeam)})`
  await page.waitFor(`!!(${made})`, 15000)

  const id = flat(await page.evaluate(`(${made}).closest('.team-node').querySelector('.team-meta p').innerText`)).replace('ID: ', '')
  await clickAction(id, 'Delete Team')
  await page.waitFor(`!(${made})`, 15000)
})
