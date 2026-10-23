// The invitation and registration flow, end to end: an admin invites a new address, offering read and write access
// to a team and a person record, the invitee registers from the emailed link, accepting both, verifies from the
// emailed link, logs in and has the affiliations and the record, and the used link is refused afterwards. The invitee
// unlinks the record at the end, leaving it as the test database has it. Needs the dev backend sending mail to MailHog
// (see README).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, register, waitForMail, verifyEmail, flat, uniqueName } from './lib/app.mjs'
import { entity } from './lib/fixture.mjs'

let browser, page
const invitee = uniqueName('invitee')
const inviteeEmail = `breedview-${invitee}@${config.mailDomain}`
// a person record the child team controls, which the admin administers, and no account is linked to
const offeredPerson = entity('person_private')
let inviteLink, startedAt, offeredTeam

before(async () => { browser = await launchBrowser(); page = browser.page; startedAt = new Date().toISOString() })
after(async () => { await browser?.close() })

test('an admin invites a new address, offering read and write access to a team and a person record', async () => {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.includes('Invite user'))`)
  await page.clickText('Invite user')
  await page.waitFor(`document.querySelector('#invite-email')`)
  await page.sleep(1000)
  await page.type('#invite-email', inviteeEmail)
  const offers = await page.evaluate(`document.querySelectorAll('.offer-item').length`)
  assert.ok(offers > 0, 'the admin administers at least one team to offer')
  const teamItem = config.adminTeam
    ? `[...document.querySelectorAll('.offer-item')].find((e) => e.innerText.includes(${JSON.stringify(config.adminTeam)}))`
    : `document.querySelector('.offer-item')`
  assert.ok(await page.evaluate(`!!(${teamItem})`), 'the team to offer is listed')
  offeredTeam = await page.evaluate(`(${teamItem}).querySelector('.offer-team').innerText.trim()`)
  // several accesses to one team: write alone would give no read access to the team's private records
  for (const level of ['READ', 'WRITE']) {
    await page.evaluate(`(${teamItem}).querySelector('input[name$="-${level}"]').click()`)
  }
  const personOption = `[...document.querySelectorAll('#invite-person option')].find((o) => o.value === ${JSON.stringify(String(offeredPerson.id))})`
  await page.waitFor(personOption)
  await page.type('#invite-person', String(offeredPerson.id))
  try {
    await page.click('.modal form button[type=submit]')
    await page.waitFor(`document.querySelector('.modal .success-message, .modal .error-message')`)
    assert.match(flat(await page.text('.modal .success-message')), /Invitation sent/)
    // the pending list reloads after sending, with the offers grouped by team
    const pending = `[...document.querySelectorAll('.invitation-item')].find((e) => e.innerText.includes(${JSON.stringify(inviteeEmail)}))`
    await page.waitFor(pending)
    const described = flat(await page.evaluate(`(${pending}).innerText`))
    assert.ok(described.includes(`${offeredTeam} (read and write)`), `the pending invitation offers read and write to the team (${described})`)
    assert.ok(described.includes(`link to ${offeredPerson.name}`), `the pending invitation offers the person record (${described})`)
    await page.click('.modal-close-btn')
  } finally {
    await logout(page)
  }
})

test('the invitation email links to the registration page with the token', async () => {
  const mail = await waitForMail(inviteeEmail, 'Invitation to register', { after: startedAt })
  inviteLink = mail.links.find((l) => l.includes('/register?token='))
  assert.ok(inviteLink, 'the email has a registration link')
  assert.ok(inviteLink.startsWith(config.appUrl), `the link points at the front end (${inviteLink})`)
})

test('the invitee registers from the link, accepting the offered team and person record', async () => {
  await logout(page)  // a signed-in user is redirected away from the registration page
  await page.goto(inviteLink)
  await page.waitFor(`document.querySelector('input[name=name]') || document.querySelector('.invitation-invalid')`)
  assert.ok(!(await page.exists('.invitation-invalid')), 'the link is valid')
  assert.equal(await page.evaluate(`document.querySelector('input[name=email]').value`), inviteeEmail, 'the email is prefilled')
  assert.equal(await page.evaluate(`document.querySelector('input[name=email]').readOnly`), true, 'the email cannot be changed')
  assert.equal(await page.evaluate(`document.querySelectorAll('input[name=acceptTeamIds]').length`), 1, 'the offered team is shown once')
  assert.match(flat(await page.text('.invitation-offer')), /read and write access/, 'with both accesses offered')
  assert.ok(await page.exists('input[name=linkPerson]'), 'the offered person record is shown')
  const result = await register(page, { username: invitee, fullname: 'Invited Tester', linkPerson: true })
  assert.match(result, /Registration successful/)
})

test('the invitee verifies from the emailed link and logs in with the affiliations and person record', async () => {
  await verifyEmail(page, inviteeEmail, startedAt)
  await login(page, invitee)
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`document.querySelector('.team-access-list')`)
  const access = flat(await page.text('.team-access-list'))
  const escaped = offeredTeam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.match(access, new RegExp(`${escaped} \\| [a-z, ]*\\bread\\b`), 'the profile lists the offered team with read access')
  assert.match(access, new RegExp(`${escaped} \\| [a-z, ]*\\bwrite\\b`), 'and with write access')
  await page.waitFor(`[...document.querySelectorAll('.profile-section')].some((e) => e.innerText.includes('Unlink from my account'))`)
  assert.ok((await page.text('body')).includes(offeredPerson.name), 'the profile shows the linked person record')
  await page.goto(`${config.appUrl}/access?tab=teams`)
  await page.waitFor(`document.querySelector('.teams-section .team-node')`)
  await page.sleep(1000)
  const badges = flat(await page.text('.teams-section'))
  assert.match(badges, /\bR\b/, 'the read affiliation badge is shown under Teams in Access control')
  assert.match(badges, /\bW\b/, 'the write affiliation badge is shown under Teams in Access control')
  await logout(page)
})

test('the invitee unlinks the person record, leaving it unlinked as before', async () => {
  await login(page, invitee)
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.includes('Unlink from my account'))`)
  await page.clickText('Unlink from my account')
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.trim() === 'Unlink')`)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.trim() === 'Unlink').click()`)
  await page.waitFor(`document.body.innerText.includes('Your account is not linked to a person record')`)
  await logout(page)
})

test('the used invitation link is refused', async () => {
  await logout(page)
  await page.goto(inviteLink)
  await page.waitFor(`document.querySelector('.invitation-invalid') || document.querySelector('input[name=name]')`)
  assert.ok(await page.exists('.invitation-invalid'), 'the page explains the link is no longer valid')
})
