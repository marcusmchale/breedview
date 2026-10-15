// A registered account in no team, and a few dev data migration entities released to REGISTERED, so that what a
// user outside the teams sees can be checked: readable entities, hidden ones between them, and placeholders.
// The ids are those of the dev database restored from migration.dump, where everything belongs to the
// "Hidden Team" team (id 2), which the admin account administers.
import { config, login, logout, register, graphql, waitForMail, verifyEmail, flat } from './app.mjs'

export const partialUser = process.env.E2E_PARTIAL_USER || 'partial1'
export const partialEmail = `breedview-${partialUser}@${config.mailDomain}`

// Released to registered users; each readable entity is separated from the next by a hidden one
export const released = {
  Study: [4],              // Study A, below the private trial "Trial A" (2) and program "dev data" (1)
  Dataset: [6],            // Factor A, in Study A, with records for the trees of field Field A
  Unit: [14761, 17156],    // field Field A, and one Variety A tree in its private "Block 1" (17560)
  Location: [81]           // Field A, below the private Subregion (82) and Region (85), in the public Country (73)
}

// Kept private: the test relies on them being hidden
export const hidden = {
  Program: [1],
  Trial: [2],
  Unit: [17560, 17157],    // Block 1, and another Variety A tree in it
  Location: [82, 85]
}

export const names = {
  program: 'dev data', trial: 'Trial A', study: 'Study A', field: 'Field A', block: 'Block 1', tree: 'Variety A',
  location: 'Field A', hiddenLocations: ['Subregion', 'Region'], country: 'Country',
  organisation: 'Galway'  // the visible team that includes the migration team, standing in for it
}

const CONTROLLERS = `query ($label: ControlledModelLabel!, $ids: [ID!]!) {
  controlsControllers(entityLabel: $label, entityIds: $ids) { status errors { message } result { release } } }`
const SET_RELEASE = `mutation ($label: ControlledModelLabel!, $ids: [ID!]!, $release: ReadRelease!) {
  controlsSetRelease(entityLabel: $label, entityIds: $ids, release: $release) { status errors { message } } }`

const labelEnum = (label) => label.toUpperCase()

async function releases(page, label, ids) {
  const payload = await graphql(page, CONTROLLERS, { label: labelEnum(label), ids })
  if (payload.status !== 'SUCCESS') throw new Error(`controllers of ${label} ${ids}: ${JSON.stringify(payload.errors)}`)
  return payload.result.map((c) => c.release)
}

async function setRelease(page, label, ids, release) {
  const payload = await graphql(page, SET_RELEASE, { label: labelEnum(label), ids, release })
  if (payload.status !== 'SUCCESS') throw new Error(`release ${label} ${ids} as ${release}: ${JSON.stringify(payload.errors)}`)
}

// Release the entities above, as the admin, where they are not released yet; refuse if a hidden one is released
export async function ensureReleases(page) {
  for (const [label, ids] of Object.entries(hidden)) {
    const current = await releases(page, label, ids)
    if (current.some((r) => r !== 'PRIVATE')) throw new Error(`${label} ${ids} should be private, but are ${current}`)
  }
  for (const [label, ids] of Object.entries(released)) {
    const current = await releases(page, label, ids)
    const toRelease = ids.filter((_, i) => current[i] === 'PRIVATE')
    if (toRelease.length) await setRelease(page, label, toRelease, 'REGISTERED')
  }
}

// Make the released entities private again
export async function restoreReleases(page) {
  for (const [label, ids] of Object.entries(released)) await setRelease(page, label, ids, 'PRIVATE')
}

// Sign in as the partial account, registering it first (invited by the admin, with no team offered) if it is new
export async function loginPartial(page) {
  try {
    await login(page, partialUser)
    return
  } catch (error) {
    if (!/failed/.test(error.message)) throw error
  }
  const startedAt = new Date().toISOString()
  await login(page, config.adminUser, config.adminPassword)
  const invite = await graphql(page, `mutation ($email: String!) { accountsInvite(email: $email) { status errors { message } } }`, { email: partialEmail })
  await logout(page)
  if (invite.status !== 'SUCCESS') throw new Error(`inviting ${partialEmail}: ${JSON.stringify(invite.errors)}`)
  const mail = await waitForMail(partialEmail, 'Invitation to register', { after: startedAt })
  const link = mail.links.find((l) => l.includes('/register?token='))
  await page.goto(link)
  const result = await register(page, { username: partialUser, fullname: 'Partial Access Tester', acceptAllOffers: false })
  if (!/Registration successful/.test(result)) throw new Error(`registering ${partialUser}: ${flat(result)}`)
  await verifyEmail(page, partialEmail, startedAt)
  await login(page, partialUser)
}

// node tests/e2e/lib/partialAccess.mjs [setup|restore]: create the account and release, or make private again
if (import.meta.url === `file://${process.argv[1]}`) {
  const { launchBrowser } = await import('./browser.mjs')
  const browser = await launchBrowser()
  try {
    const { page } = browser
    if (process.argv[2] === 'restore') {
      await login(page, config.adminUser, config.adminPassword); await restoreReleases(page); await logout(page)
      console.log('released entities are private again')
    } else {
      await loginPartial(page); await logout(page)
      await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
      console.log(`${partialUser} / ${config.password} is ready, with ${JSON.stringify(released)} released to registered users`)
    }
  } finally {
    await browser.close()
  }
}
