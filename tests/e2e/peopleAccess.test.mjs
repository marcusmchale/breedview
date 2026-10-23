// The people page under the read policy (breedgraph docs/read-access.md, docs/person.md §3). It needs an account, and
// signed-out visitors see no Persons anywhere. Each viewer is shown the Persons they see in full or by attribution: the
// full record (teams, when it was recorded, whether an account is linked) for read affiliates of the controlling team
// and the linked user, and name, institution and ORCID iD for those reading it by release only. In the full record, a
// Person's teams hidden from the viewer show as the nearest team they can see, marked as standing in. Edit and Erase
// are offered by curate and admin access, and to the linked user. What the API returns is tested in breedgraph; here,
// the cards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, flat, graphql, uniqueName } from './lib/app.mjs'
import { entities as e, teams, personView } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await logout(page); await browser?.close() })

const people = Object.keys(e).filter((name) => e[name].label === 'Person')
const listedFor = (viewer) => people.filter((name) => personView(viewer, name) !== 'RESTRICTED')
const cards = () => page.evaluate(`[...document.querySelectorAll('.person-card')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`)
const cardOf = async (name) => (await cards()).find((c) => c.includes(e[name].name))

async function openPeople(waitFor) {
  await page.goto(`${config.appUrl}/people`)
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(e[waitFor].name)})`, 30000)
  await page.sleep(1500)
}
const listed = async () => {
  const text = flat(await page.text('main'))
  return people.filter((name) => text.includes(e[name].name)).sort()
}

// The full record shows when it was recorded and whether an account is linked; the attribution view neither, nor teams
const assertFull = (card, name) => {
  assert.match(card, /Recorded/, `the full record of ${name}: ${card}`)
  assert.match(card, /Account/, `whether ${name} has an account: ${card}`)
}
const assertAttribution = (card, name) => {
  assert.ok(!/Teams|Account|Recorded/.test(card), `only the attribution of ${name}: ${card}`)
}

test('signed out, the people page sends you to log in', async () => {
  await page.goto(`${config.appUrl}/people`)
  await page.waitFor(`location.pathname === '/login'`, 30000)
  assert.match(await page.url(), /redirect=(%2F|\/)people/)
})

test('a registered user in no team: the attribution of released Persons, and their own record in full, theirs to change', async () => {
  await loginAs(page, 'outsider')
  try {
    await openPeople('person_outsider')
    assert.deepEqual(await listed(), listedFor('outsider').sort())
    assert.ok(!(await listed()).includes('person_claimed'), 'a Person the outsider cannot read is not listed')

    const own = await cardOf('person_outsider')
    assertFull(own, 'person_outsider')
    assert.ok(own.includes('a team in ') && own.includes(teams.root.name), `the stand-in team is marked: ${own}`)
    assert.match(own, /Account\s*linked/, `their own account: ${own}`)
    assert.match(own, /Edit/, 'the linked user can edit')
    assert.match(own, /Erase/, 'and erase')

    const other = await cardOf('person_public')
    assertAttribution(other, 'person_public')
    assert.ok(!/Edit|Erase/.test(other), `nor change other Persons: ${other}`)
  } finally {
    await logout(page)
  }
})

test('a read affiliate of the controlling team sees the full record, and that an account is linked even when the account is hidden', async () => {
  await loginAs(page, 'writer')
  try {
    await openPeople('person_outsider')
    assert.deepEqual(await listed(), listedFor('writer').sort())
    const card = await cardOf('person_outsider')
    assertFull(card, 'person_outsider')
    // the outsider's account is private (it is in none of the writer's teams), but the record says it is linked
    assert.match(card, /Account\s*linked/, card)
    // a Person of another organisation, released to registered users: attribution only
    assertAttribution(await cardOf('person_other'), 'person_other')
  } finally {
    await logout(page)
  }
})

test('an admin of the controlling team without curate access can erase a Person but not edit it', async () => {
  await loginAs(page, 'admin')
  try {
    await openPeople('person_private')
    const card = await cardOf('person_private')
    assert.match(card, /Erase/, 'admins of the controlling team erase')
    assert.ok(!/Edit/.test(card), `without curate access, no edit: ${card}`)
  } finally {
    await logout(page)
  }
})

test('a curator of the controlling team can edit a Person', async () => {
  await loginAs(page, 'writer')
  try {
    await openPeople('person_private')
    assert.match(await cardOf('person_private'), /Edit/)
  } finally {
    await logout(page)
  }
})

test('a Person is added only on confirming they consented to the record, and the API keeps the attestation', async () => {
  await loginAs(page, 'admin')
  const name = uniqueName('E2E consented person ')
  try {
    await page.goto(`${config.appUrl}/people`)
    await page.waitFor(`[...document.querySelectorAll('button')].some((b) => b.innerText.includes('Add Person'))`, 30000)
    await page.clickText('Add Person')
    await page.waitFor(`document.querySelector('#person-name')`)
    await page.type('#person-name', name)
    assert.equal(
      flat(await page.text('.consent-attestation')),
      'They agreed to be recorded, having been told about the record and the privacy notice'
    )
    const submit = `[...document.querySelectorAll('.modal button[type=submit]')].find((b) => b.innerText.includes('Add person'))`
    await page.sleep(1000)
    assert.equal(await page.evaluate(`${submit}.disabled`), true, 'not without their consent')
    await page.check('.consent-attestation input', true)
    // the control team loads too
    await page.waitFor(`!${submit}.disabled`, 15000)
    await page.evaluate(`${submit}.click()`)
    await page.waitFor(`!document.querySelector('#person-name') && document.body.innerText.includes(${JSON.stringify(name)})`, 15000)

    const people = await graphql(page, 'query ($name: String) { people(name: $name) { result { id consentAttestation } } }', { name })
    assert.equal(people.result.length, 1)
    assert.equal(people.result[0].consentAttestation, true)

    // erase it, as an admin of its controlling team
    await page.evaluate(`[...document.querySelectorAll('.person-card')].find((c) => c.innerText.includes(${JSON.stringify(name)}))
      .querySelector('.btn-danger').click()`)
    await page.check('.confirm-erase input', true)
    await page.evaluate(`[...document.querySelectorAll('.modal .btn-danger')].find((b) => b.innerText.includes('Erase')).click()`)
    await page.waitFor(`!document.querySelector('.confirm-erase')`, 15000)
  } finally {
    await logout(page)
  }
})
