// Persons under the read policy (breedgraph docs/read-access.md, docs/person.md): a Person the reader can read, or is
// linked to, in full; one they cannot read as a placeholder (its id, restricted) where it is referred to or asked for
// by id, anonymous readers included; searches leave hidden Persons out, so a name does not reveal them. A Person's
// teams hidden from the reader show as the nearest team they can see, marked as standing in. With lib/partialAccess.mjs:
// one contributor is public, another private and a contributor to a public dataset, and the partial account is
// linked to its own Person, private to the organisation and in the hidden team below it, which it cannot see.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql, flat } from './lib/app.mjs'
import { ensureReleases, ensurePartialPerson, loginPartial, people, names } from './lib/partialAccess.mjs'

let browser, page, ownPerson
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  ownPerson = await ensurePartialPerson(page)
  await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
  await page.goto(`${config.appUrl}/login`)
})
after(async () => { await logout(page); await browser?.close() })

const byId = async (ids) => Object.fromEntries((await graphql(page, `query ($ids: [ID!]!) { peoplePeople(ids: $ids) {
  result { id name restricted } } }`, { ids })).result.map((p) => [Number(p.id), p]))
const search = async (name) => (await graphql(page, `query ($name: String) { people(name: $name) { result { id } } }`, { name }))
  .result.map((p) => Number(p.id))
const contributors = async () => (await graphql(page, `query ($ids: [ID!]) { datasets(ids: $ids) { result {
  contributors { id name restricted } } } }`, { ids: [people.contributedTo] })).result[0].contributors
const myPerson = async () => (await graphql(page, `query { peopleMyPerson { result { id name teams { team { id name } standIn } } } }`)).result
const cards = () => page.evaluate(`[...document.querySelectorAll('.person-card, .card')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)

async function checkOutsider() {
  const found = await byId([people.hidden, people.public])
  assert.deepEqual(found[people.hidden], { id: String(people.hidden), name: null, restricted: true }, 'a hidden Person by id is restricted')
  assert.equal(found[people.public].name, people.publicName)
  assert.deepEqual(await search(people.hiddenName), [], 'a search does not reveal a hidden Person by name')
  assert.ok(!(await search(null)).includes(people.hidden), 'nor a list of everyone')
  assert.deepEqual(await contributors(), [{ id: String(people.hidden), name: null, restricted: true }], 'a hidden contributor is restricted')
}

test('anonymous: public Persons in full, hidden ones restricted where referred to and absent from searches', async () => {
  await checkOutsider()
  const mark = page.mark()
  await page.goto(`${config.appUrl}/people`)
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(people.publicName)})`, 30000)
  const text = flat(await page.text('main'))
  assert.ok(!text.includes(people.hiddenName), 'the hidden Person is not listed')
  assert.ok(!(await page.evaluate(`[...document.querySelectorAll('main button')].some((b) => /Edit|Erase|Add Person/.test(b.innerText))`)), 'no write actions')
  assert.deepEqual((await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:')), [])
})

test('a registered user in no team sees the same, and their own Person in full, its hidden team stood in for', async () => {
  await loginPartial(page)
  await checkOutsider()
  assert.deepEqual(await myPerson(), { id: String(ownPerson), name: people.ownName, teams: [{ team: { id: String(people.team), name: names.organisation }, standIn: true }] })
  assert.ok((await search(null)).includes(ownPerson), 'their own Person is listed, though private')
  await page.goto(`${config.appUrl}/people`)
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(people.ownName)})`, 30000)
  await page.sleep(1500)
  const own = (await cards()).find((c) => c.includes(people.ownName))
  assert.ok(own.includes(`a team in `) && own.includes(names.organisation), `the stand-in team is marked: ${own}`)
  assert.match(own, /Edit/, 'the linked user can edit')
  assert.match(own, /Erase/, 'and erase')
  const other = (await cards()).find((c) => c.includes(people.publicName))
  assert.ok(!/Edit|Erase/.test(other), `but not other Persons: ${other}`)
  await logout(page)
})

test('an admin of the controlling team sees the hidden Person in full, and can erase but not edit it', async () => {
  await login(page, config.adminUser, config.adminPassword)
  const found = await byId([people.hidden])
  assert.equal(found[people.hidden].name, people.hiddenName)
  assert.deepEqual(await search(people.hiddenName), [people.hidden])
  await page.goto(`${config.appUrl}/people`)
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(people.hiddenName)})`, 30000)
  await page.sleep(1500)
  const card = (await cards()).find((c) => c.includes(people.hiddenName))
  assert.match(card, /Erase/, 'admins of the controlling team erase')
  assert.ok(!/Edit/.test(card), `without curate access, no edit: ${card}`)
})

test('saving a Person keeps the teams the curator cannot see', async () => {
  // curate access to the organisation alone, not heritable, so the team below it stays hidden from the partial account
  await loginPartial(page)
  const partialUserId = (await graphql(page, 'query { accountsAccount { result { user { id } } } }')).result.user.id
  const request = await graphql(page, `mutation ($team: ID!) { accountsRequestAffiliation(teamId: $team, access: CURATE,
    heritable: false) { status errors { message } } }`, { team: people.team })
  assert.equal(request.status, 'SUCCESS', JSON.stringify(request.errors))
  await logout(page)
  await login(page, config.adminUser, config.adminPassword)
  const grant = await graphql(page, `mutation ($user: ID!, $team: ID!) { accountsApproveAffiliation(userId: $user, teamId: $team,
    access: CURATE, heritable: false) { status errors { message } } }`, { user: partialUserId, team: people.team })
  assert.equal(grant.status, 'SUCCESS', JSON.stringify(grant.errors))
  await logout(page)
  try {
    await loginPartial(page)
    const save = (teamIds) => graphql(page, `mutation ($person: PersonUpdate!) { peopleUpdatePerson(person: $person) {
      status errors { message } } }`, { person: { id: String(ownPerson), teamIds } })
    const galway = { team: { id: String(people.team), name: names.organisation }, standIn: false }
    const hidden = { team: { id: String(people.team), name: names.organisation }, standIn: true }

    assert.equal((await save([String(people.team)])).status, 'SUCCESS')
    assert.deepEqual((await myPerson()).teams, [galway, hidden], 'the organisation added, the hidden team kept')
    assert.equal((await save([])).status, 'SUCCESS')
    assert.deepEqual((await myPerson()).teams, [hidden], 'the organisation removed, the hidden team still kept')
    await logout(page)
  } finally {
    await login(page, config.adminUser, config.adminPassword)
    await graphql(page, `mutation ($user: ID!, $team: ID!) { accountsRevokeAffiliation(userId: $user, teamId: $team, access: CURATE) {
      status } }`, { user: partialUserId, team: people.team })
    await graphql(page, `mutation ($user: ID!, $team: ID!) { accountsRevokeAffiliation(userId: $user, teamId: $team, access: READ) {
      status } }`, { user: partialUserId, team: people.team })
    await logout(page)
  }
})
