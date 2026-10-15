// The people page under the read policy (breedgraph docs/read-access.md, docs/person.md): each viewer is shown the
// Persons they can read, and a linked user their own Person too; a Person's teams hidden from the viewer show as the
// nearest team they can see, marked as standing in; Edit and Erase are offered by curate and admin access, and to the
// linked user. What the API returns (restricted placeholders, searches, saving keeping hidden teams) is tested in
// breedgraph; here, the cards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, flat } from './lib/app.mjs'
import { entities as e, teams, canRead } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await logout(page); await browser?.close() })

const people = Object.keys(e).filter((name) => e[name].label === 'Person')
const readable = (viewer) => people.filter((name) => canRead(viewer, name))
const cards = () => page.evaluate(`[...document.querySelectorAll('.person-card, .card')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
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

test('anonymous: the public Persons, without write actions or failing requests', async () => {
  const mark = page.mark()
  await openPeople('person_public')
  assert.deepEqual(await listed(), readable('anonymous').sort())
  assert.ok(!(await page.evaluate(`[...document.querySelectorAll('main button')].some((b) => /Edit|Erase|Add Person/.test(b.innerText))`)), 'no write actions')
  assert.deepEqual((await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:')), [])
})

test('a registered user in no team: their own private Person too, its hidden team stood in for, and theirs to change', async () => {
  await loginAs(page, 'outsider')
  try {
    await openPeople('person_outsider')
    assert.deepEqual(await listed(), [...readable('outsider'), 'person_outsider'].sort())
    const own = await cardOf('person_outsider')
    assert.ok(own.includes('a team in ') && own.includes(teams.root.name), `the stand-in team is marked: ${own}`)
    assert.match(own, /Edit/, 'the linked user can edit')
    assert.match(own, /Erase/, 'and erase')
    const other = await cardOf('person_public')
    assert.ok(!/Edit|Erase/.test(other), `but not other Persons: ${other}`)
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
