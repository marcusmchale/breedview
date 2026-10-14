// BreedView-specific helpers: configuration, login, registration, and the MailHog mailbox the dev backend sends to.
export const config = {
  appUrl: process.env.BREEDVIEW_URL || 'http://localhost:8080',
  mailhogUrl: process.env.MAILHOG_URL || 'http://localhost:8025',
  // an existing account to act as; it must be an admin of adminTeam for the invitation test
  adminUser: process.env.E2E_ADMIN_USER || 'tester1',
  adminPassword: process.env.E2E_ADMIN_PASSWORD || 'TestPass123!',
  adminTeam: process.env.E2E_ADMIN_TEAM || null,
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
    await page.click('.nav-logout'); await page.sleep(1500); await page.goto(`${config.appUrl}/login`)
  }
  await page.waitFor(`document.querySelector('input[name=username]')`)
  await page.type('input[name=username]', username)
  await page.type('input[name=password]', password)
  await page.click('button[type=submit]')
  await page.waitFor(`!location.href.includes('/login') || document.querySelector('.error-message')`, 15000)
  await page.sleep(500)
  if ((await page.url()).includes('/login')) throw new Error(`login as ${username} failed: ${flat(await page.text('.error-message'))}`)
}

export async function logout(page) {
  if (await page.exists('.nav-logout')) { await page.click('.nav-logout'); await page.sleep(1200) }
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
