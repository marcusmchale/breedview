// Affiliation requests, end to end: the outsider, in no team, asks to read the organisation from Teams, the first tab
// of Access control; the email to the organisation's admin links to the Affiliation requests tab, which lists the
// request for that admin and not for the admin of another organisation; the admin rejects it, approves it when it is
// made again, and the outsider's profile then lists the organisation with read access. From that access's badge the
// outsider asks for it to reach the team below too, keeping it meanwhile; the admin is emailed, sees the request in
// Manage Affiliations and approves it from the requests; the team below shows the access as inherited, not changed or
// removed there; the outsider keeps it to the organisation alone at once, and asks again, which the admin rejects.
// The outsider is left in no team, as the test database has it. Needs the dev backend sending mail to MailHog (see
// README).
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
// A team's node under Teams, by its id, and its own badge for an access (R, W, C or A, + when heritable)
const teamNode = (id) => `[...document.querySelectorAll('.team-node')].find((n) => n.querySelector('.team-meta p')?.innerText.trim() === ${q(`ID: ${id}`)})`
const badge = (id, text) => `[...(${teamNode(id)})?.querySelector('.affiliation-badges').querySelectorAll('.badge') ?? []].find((b) => b.innerText.trim() === ${q(text)})`
const modalButtons = () => page.evaluate(`[...document.querySelectorAll('.modal button')].map((b) => b.innerText.trim())`)
const child = String(teams.child.id)
let heritableAskedAt

// The outsider opens the details of their read access to the organisation from its badge (R, or R+ when heritable)
const openReadDetails = async (text) => {
  await loginAs(page, 'outsider')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${badge(root, text)})`, 30000)
  await page.evaluate(`(${badge(root, text)}).click()`)
  await page.waitFor(`document.querySelector('.modal')`)
}

// The outsider asks for their read access to the organisation to reach the teams below it too, and keeps it meanwhile
const askForHeritable = async () => {
  await openReadDetails('R')
  assert.match(flat(await page.text('.modal')), /Direct only \(this team only\)/)
  await page.clickText('Request Heritable', '.modal button')
  await page.waitFor(`document.querySelector('.modal .heritability-requested')`, 15000)
  const buttons = await modalButtons()
  assert.ok(buttons.includes('Withdraw Request') && !buttons.includes('Request Heritable'), `asked once: ${buttons}`)
  assert.ok(buttons.includes('Remove Affiliation'), 'the access is kept for the organisation meanwhile')
  await page.clickText('Cancel', '.modal button')
}

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
  assert.ok(mail.text.includes(`An account requested read access to ${teams.root.name}.`),
    `the email names the team, not who asked: ${mail.text}`)
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

test('the outsider asks from its badge for their read access to reach the teams below the organisation too', async () => {
  heritableAskedAt = new Date().toISOString()
  await askForHeritable()
})

test('the admin is emailed, sees the request in Manage Affiliations, and approves it from the requests', async () => {
  const mail = await waitForMail(accounts.admin.email, 'read access requested', { after: heritableAskedAt })
  assert.ok(mail.text.includes(`An account with read access to ${teams.root.name} requested it for the teams below it too.`),
    `the email says what is asked, not who asked: ${mail.text}`)

  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${teamNode(root)})`, 30000)
  await page.evaluate(`[...(${teamNode(root)}).querySelectorAll('.team-actions button')].find((b) => b.innerText.includes('Manage Affiliations')).click()`)
  const outsiderRead = `[...document.querySelectorAll('.modal .affiliation-item')].find((e) => e.innerText.includes(${q(`@${outsider}`)}))`
  await page.waitFor(`!!(${outsiderRead})`, 15000)
  const managed = flat(await page.evaluate(`(${outsiderRead}).innerText`))
  assert.ok(managed.includes('Direct only, heritable requested'), `the request in Manage Affiliations: ${managed}`)
  assert.ok(managed.includes('Approve Heritable') && managed.includes('Keep Direct Only'), `decided there too: ${managed}`)

  await page.goto(`${config.appUrl}/access?tab=requests`)
  await page.waitFor(`!!(${requestRow})`, 30000)
  const row = flat(await page.evaluate(`(${requestRow}).innerText`))
  assert.ok(row.includes(`asks for Read access to the teams below ${teams.root.name} too`), `what is asked for: ${row}`)
  await clickInRow('Approve')
  await page.waitFor(decided, 30000)
  assert.match(flat(await page.text('.affiliation-requests-panel .success-message')),
    new RegExp(`^Approved: .*read access to the teams below ${teams.root.name}\\.$`))
})

test('the team below shows the access as inherited, where it is not changed or removed', async () => {
  await openReadDetails('R+')
  assert.match(flat(await page.text('.modal')), /Heritable \(applies to child teams\)/)
  await page.clickText('Cancel', '.modal button')
  await page.evaluate(`(${teamNode(root)}).querySelector('.expand-button').click()`)
  await page.waitFor(`!!(${badge(child, 'R+')})`, 30000)
  await page.evaluate(`(${badge(child, 'R+')}).click()`)
  await page.waitFor(`document.querySelector('.modal')`)
  assert.match(flat(await page.text('.modal')), /Inherited from a team above this one/, 'the access is shown as inherited')
  const buttons = await modalButtons()
  assert.ok(!buttons.includes('Remove Affiliation') && !buttons.includes('Make Direct Only'), `not changed there: ${buttons}`)
  await page.clickText('Cancel', '.modal button')

  // nor revoked there by the admin, who manages it on the organisation
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access`)
  await page.waitFor(`!!(${teamNode(root)})?.querySelector('.expand-button')`, 30000)
  await page.evaluate(`(${teamNode(root)}).querySelector('.expand-button').click()`)
  await page.waitFor(`!!(${teamNode(child)})`, 30000)
  await page.evaluate(`[...(${teamNode(child)}).querySelectorAll('.team-actions button')].find((b) => b.innerText.includes('Manage Affiliations')).click()`)
  const outsiderRead = `[...document.querySelectorAll('.modal .affiliation-item')].find((e) => e.innerText.includes(${q(`@${outsider}`)}))`
  await page.waitFor(`!!(${outsiderRead})`, 15000)
  const row = flat(await page.evaluate(`(${outsiderRead}).innerText`))
  assert.ok(row.includes('(Inherited)'), `marked inherited: ${row}`)
  assert.ok(!row.includes('Revoke'), `not revoked on the team below: ${row}`)
})

test('the outsider keeps the access to the organisation alone at once, and asks again, which the admin rejects', async () => {
  await openReadDetails('R+')
  await page.clickText('Make Direct Only', '.modal button')
  await page.waitFor(`/Direct only \\(this team only\\)/.test(document.querySelector('.modal')?.innerText ?? '')`, 15000)
  await page.clickText('Cancel', '.modal button')
  assert.ok(await page.evaluate(`!!(${badge(root, 'R')})`), 'the badge shows read access to the organisation alone')
  assert.ok(!(await page.evaluate(`!!(${teamNode(child)})`)), 'the team below is out of sight again')

  heritableAskedAt = new Date().toISOString()
  await askForHeritable()
  await waitForMail(accounts.admin.email, 'read access requested', { after: heritableAskedAt })
  await loginAs(page, 'admin')
  await page.goto(`${config.appUrl}/access?tab=requests`)
  await page.waitFor(`!!(${requestRow})`, 30000)
  await clickInRow('Reject')
  await page.waitFor(decided, 30000)
  assert.match(flat(await page.text('.affiliation-requests-panel .success-message')),
    new RegExp(`^Rejected: .*; they keep it for ${teams.root.name}\\.$`))

  await openReadDetails('R')
  const buttons = await modalButtons()
  assert.ok(buttons.includes('Request Heritable'), `no request is left, and one may be made again: ${buttons}`)
})
