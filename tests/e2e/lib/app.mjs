// The e2e tests' configuration (the app, the API, MailHog and the test database's accounts) and the session helpers
// bound to it (lib/session.mjs): login, logout, GraphQL calls, registration and the MailHog mailbox.
import { accounts } from './fixture.mjs'
import { createSession, flat } from './session.mjs'

export { flat }

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

export const uniqueName = (prefix) => `${prefix}${Date.now().toString(36)}`

// Sign in as one of the test database's accounts: admin, writer, stranger or outsider (lib/fixture.mjs)
export async function loginAs(page, viewer) {
  if (viewer === 'admin') return login(page, config.adminUser, config.adminPassword)
  const account = accounts[viewer]
  if (!account) throw new Error(`no account ${viewer} in the test database manifest`)
  return login(page, account.username, account.password)
}

// On the programs page, expand the collapsed programs and trials until an expression holds (e.g. a study shows). A
// level can still be loading when the next is clicked, so each round clicks whatever has appeared collapsed since.
export async function expandProgramsUntil(page, shown) {
  for (let round = 0; round < 6 && !(await page.evaluate(`!!(${shown})`)); round++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.waitFor(shown, 30000)
}

// The session helpers (lib/session.mjs), at this configuration's addresses
const session = createSession(config)
export const { login, logout, graphql, register, mailFor, waitForMail, verifyEmail } = session
