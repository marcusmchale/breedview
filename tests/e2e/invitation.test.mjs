// The invitation and registration flow, end to end: an admin invites a new address with a team offer,
// the invitee registers from the emailed link, verifies from the emailed link, logs in and has the affiliation,
// and the used link is refused afterwards. Needs the dev backend sending mail to MailHog (see README).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, register, waitForMail, verifyEmail, flat, uniqueName } from './lib/app.mjs'

let browser, page
const invitee = uniqueName('invitee')
const inviteeEmail = `breedview-${invitee}@${config.mailDomain}`
let inviteLink, startedAt

before(async () => { browser = await launchBrowser(); page = browser.page; startedAt = new Date().toISOString() })
after(async () => { await browser?.close() })

test('an admin invites a new address, offering a team', async () => {
  await login(page, config.adminUser, config.adminPassword)
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.includes('Invite user'))`)
  await page.clickText('Invite user')
  await page.waitFor(`document.querySelector('#invite-email')`)
  await page.sleep(1000)
  await page.type('#invite-email', inviteeEmail)
  const offers = await page.evaluate(`document.querySelectorAll('.offer-item select').length`)
  assert.ok(offers > 0, 'the admin administers at least one team to offer')
  const teamSelector = config.adminTeam
    ? `[...document.querySelectorAll('.offer-item')].find((e) => e.innerText.includes(${JSON.stringify(config.adminTeam)}))?.querySelector('select')`
    : `document.querySelector('.offer-item select')`
  assert.ok(await page.evaluate(`!!(${teamSelector})`), 'the team to offer is listed')
  await page.evaluate(`(() => { const s = ${teamSelector}; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(s, 'WRITE'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  try {
    await page.click('.modal form button[type=submit]')
    await page.waitFor(`document.querySelector('.modal .success-message, .modal .error-message')`)
    assert.match(flat(await page.text('.modal .success-message')), /Invitation sent/)
    // the pending list reloads after sending
    await page.waitFor(`document.querySelector('.invitations-section')?.innerText.includes(${JSON.stringify(inviteeEmail)})`)
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

test('the invitee registers from the link, accepting the offered team', async () => {
  await logout(page)  // a signed-in user is redirected away from the registration page
  await page.goto(inviteLink)
  await page.waitFor(`document.querySelector('input[name=name]') || document.querySelector('.invitation-invalid')`)
  assert.ok(!(await page.exists('.invitation-invalid')), 'the link is valid')
  assert.equal(await page.evaluate(`document.querySelector('input[name=email]').value`), inviteeEmail, 'the email is prefilled')
  assert.equal(await page.evaluate(`document.querySelector('input[name=email]').readOnly`), true, 'the email cannot be changed')
  assert.ok(await page.exists('input[name=acceptTeamIds]'), 'the offered team is shown')
  const result = await register(page, { username: invitee, fullname: 'Invited Tester' })
  assert.match(result, /Registration successful/)
})

test('the invitee verifies from the emailed link and logs in with the affiliation', async () => {
  await verifyEmail(page, inviteeEmail, startedAt)
  await login(page, invitee)
  await page.goto(`${config.appUrl}/profile#teams`)
  await page.waitFor(`document.querySelector('#teams .teams-section')`)
  await page.sleep(1000)
  const badges = flat(await page.text('#teams .teams-section'))
  assert.match(badges, /\bW\b/, 'the write affiliation badge is shown')
  await logout(page)
})

test('the used invitation link is refused', async () => {
  await logout(page)
  await page.goto(inviteLink)
  await page.waitFor(`document.querySelector('.invitation-invalid') || document.querySelector('input[name=name]')`)
  assert.ok(await page.exists('.invitation-invalid'), 'the page explains the link is no longer valid')
})
