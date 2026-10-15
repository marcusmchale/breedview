// A registered account in no team, and a few entities of the dev database released to registered users or the
// public, so that what a user outside the teams, or an anonymous one, sees can be checked: readable entities, hidden
// ones between them, and placeholders. Which entities is set in fixture.local.mjs.
import { config, login, logout, register, graphql, waitForMail, verifyEmail, flat } from './app.mjs'

export const partialUser = process.env.E2E_PARTIAL_USER || 'partial1'
export const partialEmail = `breedview-${partialUser}@${config.mailDomain}`

// The entities of the dev database to use, in fixture.local.mjs, which is not committed (see fixture.example.mjs)
let fixture
try {
  fixture = await import('./fixture.local.mjs')
} catch (error) {
  throw new Error('tests/e2e/lib/fixture.local.mjs is missing or broken: copy fixture.example.mjs to it and fill in the ' +
    'ids and names of the database the tests run against (' + error.message + ')')
}
export const {
  releasedTo, released, hidden, people, germplasm, references, names,
  hiddenTeam, adminGermplasm, germplasmNames, datasets, perf
} = fixture
const { originally } = fixture

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

// Release the entities above, as the admin, where they are not released as listed; refuse if a hidden one is released
export async function ensureReleases(page) {
  for (const [label, ids] of Object.entries(hidden)) {
    const current = await releases(page, label, ids)
    if (current.some((r) => r !== 'PRIVATE')) throw new Error(`${label} ${ids} should be private, but are ${current}`)
  }
  for (const [level, entities] of Object.entries(releasedTo)) {
    for (const [label, ids] of Object.entries(entities)) {
      const current = await releases(page, label, ids)
      const toRelease = ids.filter((_, i) => current[i] !== level)
      if (toRelease.length) await setRelease(page, label, toRelease, level)
    }
  }
}

// Make the released entities private again
export async function restoreReleases(page) {
  for (const entities of Object.values(releasedTo)) {
    for (const [label, ids] of Object.entries(entities)) await setRelease(page, label, ids, 'PRIVATE')
  }
  for (const [level, entities] of Object.entries(originally)) {
    for (const [label, ids] of Object.entries(entities)) await setRelease(page, label, ids, level)
  }
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

// The id of the partial account's own Person: created private to Galway by the admin and linked to the
// account through a request the admin approves, the first time
export async function ensurePartialPerson(page) {
  await loginPartial(page)
  const own = (await graphql(page, 'query { peopleMyPerson { result { id } } }')).result
  const partialUserId = (await graphql(page, 'query { accountsAccount { result { user { id } } } }')).result.user.id
  await logout(page)
  if (own) return Number(own.id)

  await login(page, config.adminUser, config.adminPassword)
  const find = async () => (await graphql(page, 'query ($name: String) { people(name: $name) { result { id linkedUser { id } } } }',
    { name: people.ownName })).result.find((p) => !p.linkedUser)
  if (!(await find())) {
    const created = await graphql(page, `mutation ($person: PersonInput!, $team: ID!) {
      peopleCreatePerson(person: $person, controlTeamId: $team, release: PRIVATE) { status errors { message } } }`,
    { person: { name: people.ownName, informedAttestation: true, teamIds: [people.ownTeam] }, team: people.team })
    if (created.status !== 'SUCCESS') throw new Error(`creating ${people.ownName}: ${JSON.stringify(created.errors)}`)
  }
  const personId = (await find()).id
  await logout(page)

  await loginPartial(page)
  const claim = await graphql(page, 'mutation ($id: ID!) { peopleRequestClaim(personId: $id) { status errors { message } } }', { id: personId })
  await logout(page)
  await login(page, config.adminUser, config.adminPassword)
  const approved = await graphql(page, 'mutation ($id: ID!, $user: ID!) { peopleApproveClaim(personId: $id, userId: $user) { status errors { message } } }',
    { id: personId, user: partialUserId })
  await logout(page)
  if (approved.status !== 'SUCCESS') throw new Error(`linking ${people.ownName}: ${JSON.stringify([claim.errors, approved.errors])}`)
  return Number(personId)
}

// The id of the admin account's own Person, public in Galway, created and linked the first time: write stamps by the
// admin (such as on the public Galway germplasm it recorded) are attributed to it for users who cannot see the account
export const adminPersonName = 'Admin Tester'
export async function ensureAdminPerson(page) {
  await login(page, config.adminUser, config.adminPassword)
  try {
    const own = (await graphql(page, 'query { peopleMyPerson { result { id } } }')).result
    if (own) return Number(own.id)
    const adminUserId = (await graphql(page, 'query { accountsAccount { result { user { id } } } }')).result.user.id
    const find = async () => (await graphql(page, 'query ($name: String) { people(name: $name) { result { id linkedUser { id } } } }',
      { name: adminPersonName })).result.find((p) => !p.linkedUser)
    if (!(await find())) {
      const created = await graphql(page, `mutation ($person: PersonInput!, $team: ID!) {
        peopleCreatePerson(person: $person, controlTeamId: $team, release: PUBLIC) { status errors { message } } }`,
      { person: { name: adminPersonName, informedAttestation: true }, team: people.team })
      if (created.status !== 'SUCCESS') throw new Error(`creating ${adminPersonName}: ${JSON.stringify(created.errors)}`)
    }
    const personId = (await find()).id
    const claim = await graphql(page, 'mutation ($id: ID!) { peopleRequestClaim(personId: $id) { status errors { message } } }', { id: personId })
    const approved = await graphql(page, 'mutation ($id: ID!, $user: ID!) { peopleApproveClaim(personId: $id, userId: $user) { status errors { message } } }',
      { id: personId, user: adminUserId })
    if (approved.status !== 'SUCCESS') throw new Error(`linking ${adminPersonName}: ${JSON.stringify([claim.errors, approved.errors])}`)
    return Number(personId)
  } finally {
    await logout(page)
  }
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
      await ensurePartialPerson(page)
      await ensureAdminPerson(page)
      await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
      console.log(`${partialUser} / ${config.password} is ready, with ${JSON.stringify(releasedTo)} released`)
    }
  } finally {
    await browser.close()
  }
}
