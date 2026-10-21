// Affiliation requests, end to end: the outsider, in no team, asks to read the organisation from Teams, the first tab
// of Access control; the email to the organisation's admin links to the Affiliation requests tab, which lists the
// request for that admin and not for the admin of another organisation; the admin rejects it, approves it when it is
// made again, and the outsider's profile then lists the organisation with read access. The outsider is left in no
// team, as the test database has it. Needs the dev backend sending mail to MailHog (see README).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, waitForMail, flat } from './lib/app.mjs'
import { accounts, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const root = String(teams.root.id)
const outsider = accounts.outsider.username

let browser, page, startedAt, requestsLink

// The outsider removes their affiliation to the organisation, if they have one
const removeAffiliation = async () => {
  await loginAs(page, 'outsider')
  await graphql(page, 'mutation ($team: ID!) { accountsRemoveAffiliation(teamId: $team, access: READ) { status } }', { team: root })
}

before(async () => {
  browser = await launchBrowser(); page = browser.page
  // a request left by an interrupted run would make the new one do nothing and send no email
  await removeAffiliation()
  await logout(page)
  startedAt = new Date().toISOString()
})
after(async () => {
  try {
    await removeAffiliation()
    await logout(page)
  } finally {
    await browser?.close()
  }
})

// The outsider's request to the organisation in the requests list
const requestRow = `[...document.querySelectorAll('.request-item')].find((e) => e.innerText.includes(${q(`(${outsider})`)}) && e.innerText.includes(${q(teams.root.name)}))`
const tabCount = async () => Number(await page.evaluate(`document.querySelector('.page-tab .tab-count')?.innerText.trim() ?? 0`))
const clickInRow = (label) => page.evaluate(`[...(${requestRow}).querySelectorAll('button')].find((b) => b.innerText.includes(${q(label)})).click()`)
const decided = `!(${requestRow}) && !!document.querySelector('.affiliation-requests-panel .success-message')`

test('the outsider asks to read the organisation from Teams, the first tab of Access control', async () => {
  await loginAs(page, 'outsider')
  await page.goto(`${config.appUrl}/access`)
  const rootNode = `[...document.querySelectorAll('.team-node')].find((n) => n.querySelector('.team-meta p')?.innerText.trim() === ${q(`ID: ${root}`)})`
  await page.waitFor(`!!(${rootNode})`, 30000)
  assert.equal(flat(await page.text('.page-tab.active')), 'Teams', 'Teams is the tab shown')
  await page.evaluate(`[...(${rootNode}).querySelectorAll('.team-actions button')].find((b) => b.innerText.includes('Request Affiliation')).click()`)
  await page.waitFor(`document.querySelector('.modal select')`)
  await page.type('.modal select', 'READ')
  await page.click('.modal form button[type=submit]')
  await page.waitFor(`document.querySelector('.modal .success-message, .modal .error-message')`, 15000)
  assert.match(flat(await page.text('.modal')), /Affiliation requested/, 'the request is made')
})

test("the email to the organisation's admin links to the requests", async () => {
  const mail = await waitForMail(accounts.admin.email, 'read access requested', { after: startedAt })
  assert.ok(mail.text.includes(`read access to ${teams.root.name}`), `the email names the team: ${mail.text}`)
  requestsLink = mail.links.find((l) => l.includes('/access?tab=requests'))
  assert.ok(requestsLink?.startsWith(config.appUrl), `the email links to the requests in the app: ${mail.links}`)
})

test("the link opens the requests, which list the outsider's for the organisation's admin", async () => {
  await loginAs(page, 'admin')
  await page.goto(requestsLink)
  await page.waitFor(`!!(${requestRow})`, 30000)
  assert.match(flat(await page.text('.page-tab.active')), /^Affiliation requests/, 'the requests tab is shown')
  const row = flat(await page.evaluate(`(${requestRow}).innerText`))
  assert.ok(row.includes(`asks for Read access to ${teams.root.name}`), `what is asked for: ${row}`)
  assert.ok((await tabCount()) >= 1, 'the tab counts the waiting requests')
})

test('the admin of another organisation is not asked', async () => {
  await loginAs(page, 'stranger')
  await page.goto(`${config.appUrl}/access?tab=requests`)
  await page.waitFor(`document.querySelector('.affiliation-requests-panel .request-list, .affiliation-requests-panel .empty-state')`, 30000)
  await page.sleep(1000)
  assert.ok(!(await page.evaluate(`!!(${requestRow})`)), 'the request is not listed')
})

test('the admin rejects the request, and approves it when it is made again', async () => {
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access?tab=requests`)
  await page.waitFor(`!!(${requestRow})`, 30000)
  const waiting = await tabCount()
  await clickInRow('Reject')
  await page.waitFor(decided, 30000)
  assert.match(flat(await page.text('.affiliation-requests-panel .success-message')), /^Rejected:/)
  assert.equal(await tabCount(), waiting - 1, 'the tab counts one request fewer')

  // a rejected request is revoked, so the outsider may ask again; not heritable, as from the Teams tab (the API's
  // default is heritable)
  await loginAs(page, 'outsider')
  const again = await graphql(page,
    'mutation ($team: ID!) { accountsRequestAffiliation(teamId: $team, access: READ, heritable: false) { status errors { message } } }',
    { team: root })
  assert.equal(again.status, 'SUCCESS', `asked again: ${q(again.errors)}`)

  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access?tab=requests`)
  await page.waitFor(`!!(${requestRow})`, 30000)
  await clickInRow('Approve')
  await page.waitFor(decided, 30000)
  assert.match(flat(await page.text('.affiliation-requests-panel .success-message')), /^Approved:/)
})

test("the outsider's profile lists the organisation with read access", async () => {
  await loginAs(page, 'outsider')
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`document.querySelector('.team-access-list')`, 30000)
  const access = flat(await page.text('.team-access-list'))
  assert.ok(access.includes(`${teams.root.name} | read`), `the organisation, with read access: ${access}`)
})
