// BreedView-specific helpers: configuration, login, registration, and the MailHog mailbox the dev backend sends to.
import { accounts } from './fixture.mjs'

export const config = {
  appUrl: process.env.BREEDVIEW_URL || 'http://localhost:8080',
  apiUrl: process.env.BREEDGRAPH_URL || 'http://localhost:8000',
  mailhogUrl: process.env.MAILHOG_URL || 'http://localhost:8025',
  // the account to act as, by default the test database's admin; it must be an admin of adminTeam (by default the
  // first team it administers) for the invitation test
  adminUser: process.env.E2E_ADMIN_USER || accounts.admin.username,
  adminPassword: process.env.E2E_ADMIN_PASSWORD || accounts.admin.password,
  adminTeam: process.env.E2E_ADMIN_TEAM || null,
  // the password of the accounts the tests register
  password: 'TestPass123!',
  // the address that registration emails go to, with a unique local part per run
  mailDomain: process.env.E2E_MAIL_DOMAIN || 'example.com'
}

export const flat = (text) => (text ?? '').replace(/\n+/g, ' | ').trim()

export const uniqueName = (prefix) => `${prefix}${Date.now().toString(36)}`

export async function login(page, username, password = config.password) {
  await page.goto(`${config.appUrl}/login`)
  await page.sleep(1000)
  if (!(await page.url()).includes('/login')) {
    // already signed in as someone: sign out first
    await logout(page)
    await page.goto(`${config.appUrl}/login`)
  }
  try {
    await page.waitFor(`document.querySelector('input[name=username]')`)
  } catch (error) {
    const state = await page.evaluate('document.readyState')
    const errors = page.consoleErrors(Math.max(0, page.mark() - 200)).slice(-3).join(' | ')
    // requests sent and not finished since the last 300 events, e.g. a sign-in check the router guard waits on
    const recent = page.events.slice(-3000)
    const failed = recent.filter((e) => e.method === 'Network.loadingFailed').map((e) => e.params.errorText).slice(-3)
    const logs = recent.filter((e) => e.method === 'Log.entryAdded').map((e) => `${e.params.entry.level}: ${e.params.entry.text}`).slice(-3)
    const counts = {}
    for (const e of recent) {
      if (e.method === 'Network.requestWillBeSent') {
        const path = e.params.request.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
        if (!path.startsWith('/src') && !path.startsWith('/node_modules') && !path.startsWith('/@')) counts[path] = (counts[path] ?? 0) + 1
      }
    }
    const statuses = recent.filter((e) => e.method === 'Network.responseReceived' && e.params.response.status >= 400)
      .map((e) => `${e.params.response.status} ${e.params.response.url.replace(/^https?:\/\/[^/]+/, '')}`).slice(-3)
    const finished = new Set(recent.filter((e) => ['Network.loadingFinished', 'Network.loadingFailed'].includes(e.method)).map((e) => e.params.requestId))
    const pending = recent.filter((e) => e.method === 'Network.requestWillBeSent' && !finished.has(e.params.requestId))
      .map((e) => `${e.params.request.method} ${e.params.request.url.replace(/^https?:\/\/[^/]+/, '')}`)
    const shot = await page.screenshot(`${process.env.E2E_SHOT_DIR || "/tmp"}/breedview-e2e-login-failure.png`)
    throw new Error(`no login form for ${username} at ${await page.url()} (${state}, screenshot ${shot}): ` +
      `${flat(await page.text('body')).slice(0, 200)} console: ${errors.slice(0, 400)} pending: ${pending.slice(-5).join(', ')} failed: ${failed.join(', ')} log: ${logs.join(' | ').slice(0, 400)} http: ${statuses.join(', ')} requests: ${JSON.stringify(counts).slice(0, 300)}`)
  }
  await page.type('input[name=username]', username)
  await page.type('input[name=password]', password)
  await page.click('button[type=submit]')
  await page.waitFor(`!location.href.includes('/login') || document.querySelector('.error-message')`, 15000)
  await page.sleep(500)
  if ((await page.url()).includes('/login')) throw new Error(`login as ${username} failed: ${flat(await page.text('.error-message'))}`)
}

// Sign in as one of the test database's accounts: admin, writer, stranger or outsider (lib/fixture.mjs)
export async function loginAs(page, viewer) {
  if (viewer === 'admin') return login(page, config.adminUser, config.adminPassword)
  const account = accounts[viewer]
  if (!account) throw new Error(`no account ${viewer} in the test database manifest`)
  return login(page, account.username, account.password)
}

// Navigating away before the logout request has finished would cancel it and leave the session signed in, so wait
// until the app has left for the login page. The app goes there even when its logout request fails (e.g. on a CSRF
// token replaced meanwhile), so check the session ended, and end it through the API if not.
export async function logout(page) {
  if (await page.exists('.nav-logout')) {
    await page.click('.nav-logout')
    await page.waitFor(`!document.querySelector('.nav-logout')`, 15000)
    if ((await graphql(page, 'query { accountsAccount { status } }')).status === 'SUCCESS') {
      await graphql(page, 'mutation { accountsLogout { status } }')
    }
  }
}

// Run a GraphQL operation from the page, as the signed-in user, with the session cookie and a CSRF token.
// Returns the operation's payload (data[field]); throws on GraphQL errors.
export async function graphql(page, query, variables = {}) {
  const response = await page.evaluate(`(async () => {
    const api = ${JSON.stringify(config.apiUrl)}
    const { token } = await (await fetch(api + '/csrf', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })).json()
    const post = (csrf) => fetch(api + '/graphql', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ query: ${JSON.stringify(query)}, variables: ${JSON.stringify(variables)} })
    })
    let response = await post(token)
    // the app's own requests may have replaced the token meanwhile: retry once with the new one, as the app does
    if (response.status === 403 && response.headers.get('X-CSRF-Token')) response = await post(response.headers.get('X-CSRF-Token'))
    return response.json()
  })()`)
  if (response.errors?.length) throw new Error('GraphQL: ' + response.errors.map((e) => e.message).join('; '))
  if (!response.data) throw new Error('GraphQL: no data in ' + JSON.stringify(response).slice(0, 500))
  return Object.values(response.data)[0]
}

// Fill the registration form, with or without an invitation token in the page's URL, and submit
export async function register(page, { username, fullname = '', password = config.password, email = null, acceptAllOffers = true }) {
  await page.waitFor(`document.querySelector('input[name=name]')`)
  await page.type('input[name=name]', username)
  if (fullname) await page.type('input[name=fullname]', fullname)
  if (email && await page.evaluate(`!document.querySelector('input[name=email]').readOnly`)) await page.type('input[name=email]', email)
  await page.type('input[name=password]', password)
  if (acceptAllOffers) await page.evaluate(`[...document.querySelectorAll('input[name=acceptTeamIds]')].forEach((e) => { if (!e.checked) e.click() })`)
  await page.check('input[name=gdprConsent]', true)
  await page.sleep(200)
  await page.click('button[type=submit]')
  await page.waitFor(`document.querySelector('.form-container .success-message, .form-container .error-message')`, 15000)
  return flat(await page.text('.form-container .success-message, .form-container .error-message'))
}

// Messages MailHog holds for an address, newest first: { subject, text, links, created }
export async function mailFor(address) {
  const data = await (await fetch(`${config.mailhogUrl}/api/v2/messages?limit=200`)).json()
  const decode = (part) => {
    const encoding = (part.Headers['Content-Transfer-Encoding'] || [''])[0].toLowerCase()
    if (encoding === 'base64') return Buffer.from(part.Body, 'base64').toString('utf8')
    if (encoding === 'quoted-printable') return part.Body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    return part.Body
  }
  return data.items
    .filter((item) => item.To.some((to) => `${to.Mailbox}@${to.Domain}` === address))
    .map((item) => {
      const parts = (item.MIME && item.MIME.Parts) || [item.Content]
      const text = parts.filter((p) => (p.Headers['Content-Type'] || [''])[0].startsWith('text/plain') || !p.Headers['Content-Type']).map(decode).join('\n')
      return { created: item.Created, subject: item.Content.Headers.Subject?.[0] ?? '', text, links: text.match(/https?:\/\/\S+/g) ?? [] }
    })
}

// Wait for a message with the given subject fragment to arrive for an address, and return it
export async function waitForMail(address, subjectIncludes, { timeout = 20000, after = null } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const match = (await mailFor(address)).find((m) => m.subject.includes(subjectIncludes) && (!after || m.created > after))
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`no email "${subjectIncludes}" for ${address} within ${timeout} ms`)
}

// Open the verification link from the account's verification email
export async function verifyEmail(page, address, after = null) {
  const mail = await waitForMail(address, 'email verification', { after })
  const link = mail.links.find((l) => l.includes('verify'))
  if (!link) throw new Error('verification email has no link: ' + mail.text)
  await page.goto(link)
  await page.sleep(2500)
}
