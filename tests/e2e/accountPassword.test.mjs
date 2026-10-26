// Changing a password from the profile: the form asks for the current password once a new password or a new email
// address is entered, refuses a wrong one, and after the change the browser is still signed in, as the API ends the
// account's other sign-ins and signs this one in again. The account is one the test registers, invited by the admin,
// as the test database's own passwords can't be set again through the API (they predate its password policy). Needs
// the backend sending mail to MailHog (see README).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, loginAs, logout, graphql, register, waitForMail, verifyEmail, flat, uniqueName } from './lib/app.mjs'

let browser, page
const username = uniqueName('passwords')
const email = `breedview-${username}@${config.mailDomain}`
const newPassword = 'Changed-Passw0rd!'

before(async () => { browser = await launchBrowser(); page = browser.page })
after(async () => { await browser?.close() })

const currentField = `document.querySelector('input[name=currentPassword]')`
const message = `document.querySelector('.modal-content .success-message, .modal-content .error-message')`

async function openForm() {
  await page.goto(`${config.appUrl}/profile`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.includes('Edit account'))`)
  await page.clickText('Edit account')
  await page.waitFor(`document.querySelector('.modal-content input[name=password]')`)
}

async function submit() {
  await page.click('.modal-content button[type=submit]')
  await page.waitFor(message, 15000)
  return flat(await page.evaluate(`(${message}).innerText`))
}

test('an account registers from an invitation, to change its password', async () => {
  const startedAt = new Date().toISOString()
  await loginAs(page, 'admin')
  const invited = await graphql(page, 'mutation ($email: String!) { accountsInvite(email: $email) { status errors { message } } }', { email })
  assert.equal(invited.status, 'SUCCESS', JSON.stringify(invited.errors))
  await logout(page)
  const mail = await waitForMail(email, 'Invitation to register', { after: startedAt })
  await page.goto(mail.links.find((l) => l.includes('/register?token=')))
  assert.match(await register(page, { username, email }), /Registration successful/)
  await verifyEmail(page, email, startedAt)
})

test('a new password asks for the current one, refuses a wrong one, and leaves the browser signed in', async () => {
  await login(page, username)
  try {
    await openForm()
    assert.ok(!(await page.evaluate(`!!${currentField}`)), 'nothing is asked while nothing guarded is changed')
    await page.type('.modal-content input[name=email]', 'someone.else@example.org')
    await page.waitFor(currentField)
    await page.type('.modal-content input[name=email]', '')
    await page.waitFor(`!${currentField}`)

    await page.type('.modal-content input[name=password]', newPassword)
    await page.waitFor(currentField)
    await page.type('.modal-content input[name=currentPassword]', config.password + 'x')
    assert.equal(await submit(), 'Incorrect password')

    await openForm()
    await page.type('.modal-content input[name=password]', newPassword)
    await page.waitFor(currentField)
    await page.type('.modal-content input[name=currentPassword]', config.password)
    assert.match(await submit(), /signed you out everywhere else/)

    // signed in still, by the cookie the change set
    const signedIn = await graphql(page, 'query { accountsAccount { result { user { name } } } }')
    assert.equal(signedIn.result?.user?.name, username)
  } finally {
    await logout(page)
  }
  await login(page, username, newPassword)
  await logout(page)
})
