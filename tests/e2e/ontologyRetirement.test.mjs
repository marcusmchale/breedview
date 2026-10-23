// Removing ontology entries keeps the data that cites them (breedgraph README, Ontology): signed in as the admin, an
// ontology admin, a subject and a trait describing it are deprecated together from the subject's entry form, as the
// trait is defined by the subject, and a commit removes both. A unit citing the subject shows it as retired, and the
// subject is restored from that tag; the trait is restored from the view of the version before, where it was current.
// A last commit makes both current again.
//
// This test commits ontology versions, two or three each run, and they stay in the ontology's history. The subject and
// trait keep their names from run to run ("E2E retired subject", "E2E retired trait"), created and committed by the
// first run; the unit is made for the run and deleted.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, flat, uniqueName } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const SUBJECT = 'E2E retired subject'
const TRAIT = 'E2E retired trait'
const LOCATION = String(e.field.id)

let browser, page, subject, trait, unitId

async function mutate(field, query, variables) {
  const payload = await graphql(page, query, variables)
  assert.equal(payload.status, 'SUCCESS', `${field}: ${q(payload.errors)}`)
  return payload
}
const commit = (comment) => mutate('ontologyCommitVersion',
  'mutation ($c: String) { ontologyCommitVersion(versionChange: PATCH, comment: $c) { status errors { message } } }', { c: comment })

// the entries by name, in a view, with their phases
async function entriesNamed(view, labels) {
  const payload = await graphql(page, `query { ontologyEntries(labels: [${labels}], view: ${view}) { result { id name phase } } }`)
  return payload.result ?? []
}
const phases = async () => Object.fromEntries(
  (await graphql(page, 'query ($ids: [ID!]) { ontologyEntries(ids: $ids, view: EDITORIAL) { result { id phase } } }', { ids: [subject.id, trait.id] }))
    .result.map((entry) => [entry.id, entry.phase])
)

// Makes the subject and trait current, whatever a run before left them as
async function settle(comment) {
  const now = await phases()
  if (Object.values(now).every((phase) => phase === 'ACTIVE')) return
  const removed = Object.keys(now).filter((id) => now[id] === 'REMOVED')
  const deprecated = Object.keys(now).filter((id) => now[id] === 'DEPRECATED')
  if (removed.length) await mutate('ontologyRestoreEntries', 'mutation ($ids: [ID!]!) { ontologyRestoreEntries(ids: $ids) { status errors { message } } }', { ids: removed })
  if (deprecated.length) await mutate('ontologyCancelDeprecateEntries', 'mutation ($ids: [ID!]!) { ontologyCancelDeprecateEntries(ids: $ids) { status errors { message } } }', { ids: deprecated })
  await commit(comment)
}

before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'admin')
  // the subject and trait, created by the first run (the editorial view lists them unless removed, as runs leave them)
  const named = async (name, label) => (await entriesNamed('EDITORIAL', label)).find((entry) => entry.name === name)
  subject = await named(SUBJECT, 'SUBJECT')
  if (!subject) {
    await mutate('ontologyCreateSubject', 'mutation ($s: SubjectInput!) { ontologyCreateSubject(subject: $s) { status errors { message } } }', { s: { name: SUBJECT } })
    subject = await named(SUBJECT, 'SUBJECT')
  }
  trait = await named(TRAIT, 'TRAIT')
  if (!trait) {
    await mutate('ontologyCreateTrait', 'mutation ($t: TraitInput!) { ontologyCreateTrait(trait: $t) { status errors { message } } }', { t: { name: TRAIT, subjectIds: [subject.id] } })
    trait = await named(TRAIT, 'TRAIT')
  }
  await settle('E2E: the entries the retirement test retires')
  assert.deepEqual(await phases(), { [subject.id]: 'ACTIVE', [trait.id]: 'ACTIVE' })

  // a unit citing the subject, at the scenario's field
  const name = uniqueName('E2E retired subject unit ')
  await mutate('unitsCreateUnit',
    'mutation ($u: UnitInput!, $team: ID!, $p: PositionInput) { unitsCreateUnit(unit: $u, controlTeamId: $team, position: $p) { status errors { message } } }',
    { u: { name, subjectId: subject.id }, team: String(teams.root.id), p: { locationId: LOCATION, start: '2024-01-01' } })
  const roots = await graphql(page, 'query ($ids: [ID!]) { unitsRoots(locationIds: $ids) { result { id name } } }', { ids: [LOCATION] })
  unitId = roots.result.find((unit) => unit.name === name)?.id
  assert.ok(unitId, `the unit ${name} is at the field`)
})

after(async () => {
  try {
    if (unitId) await mutate('unitsDeleteUnit', 'mutation ($id: ID!) { unitsDeleteUnit(id: $id) { status errors { message } } }', { id: unitId })
    // whatever happened, leave the entries current, for the next run
    if (subject && trait) await settle('E2E: the retirement test leaves its entries current')
  } finally {
    await logout(page); await browser?.close()
  }
})

const node = (id) => `[...document.querySelectorAll('g.node')].find((g) => String(g.__data__?.id) === ${q(String(id))})`

test('the subject is deprecated with the trait it defines, from its entry form', async () => {
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(node(subject.id), 30000)
  await page.sleep(500)
  await page.evaluate(`${node(subject.id)}.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`)
  await page.waitFor(`document.querySelector('.modal-container h2')?.innerText.includes('Update Subject')`, 15000)
  await page.evaluate(`[...document.querySelectorAll('.modal-container .form-actions button')].find((b) => b.innerText.trim() === 'Deprecate').click()`)
  await page.waitFor(`document.querySelector('.lifecycle-panel')`)
  const panel = flat(await page.text('.lifecycle-panel'))
  assert.match(panel, new RegExp(`Deprecated with it, as they are defined by it: \\| Trait: ${TRAIT}`), panel)

  await page.evaluate(`[...document.querySelectorAll('.lifecycle-panel button')].find((b) => b.innerText.includes('Deprecate 2 entries')).click()`)
  await page.waitFor(`!document.querySelector('.modal-container')`, 15000)
  assert.deepEqual(await phases(), { [subject.id]: 'DEPRECATED', [trait.id]: 'DEPRECATED' })
  await commit('E2E: retire the subject and its trait')
  assert.deepEqual(await phases(), { [subject.id]: 'REMOVED', [trait.id]: 'REMOVED' })
})

test('the unit citing the subject shows it retired, and the subject is restored from there', async () => {
  const card = '.location-units-panel .details-card'
  const subjectField = `[...document.querySelectorAll('${card} .fields-grid .field')].find((f) => f.querySelector('.field-label').textContent.trim() === 'Subject')`
  await page.goto(`${config.appUrl}/units?location=${LOCATION}`)
  const block = `[...document.querySelectorAll('.block-item')].find((b) => b.querySelector('.block-name')?.innerText.trim().startsWith('E2E retired subject unit') && b.querySelector('.retired-tag'))`
  await page.waitFor(block, 30000)
  await page.evaluate(`${block}.click()`)
  await page.waitFor(`${subjectField}?.querySelector('.retired-tag')`, 30000)
  assert.equal((await page.evaluate(`${subjectField}.querySelector('.field-value').textContent`)).replace(/\s+/g, ' ').trim(), `${SUBJECT} retired`)

  await page.evaluate(`${subjectField}.querySelector('.retired-tag').click()`)
  await page.waitFor(`document.querySelector('.restore-modal .modal-buttons .btn-primary')`, 15000)
  assert.equal(flat(await page.text('.restore-modal h3')), `Restore Subject: ${SUBJECT}`)
  await page.click('.restore-modal .modal-buttons .btn-primary')
  await page.waitFor(`document.querySelector('.restore-modal .success-message')`, 15000)
  assert.equal((await phases())[subject.id], 'DRAFT', 'restored as a draft')
  await page.click('.restore-modal .modal-buttons .btn-secondary')
  await page.waitFor(`!document.querySelector('.restore-modal') && !${subjectField}?.querySelector('.retired-tag')`, 15000)
})

test('the trait is restored from the view of the version before, where it was current', async () => {
  await page.goto(`${config.appUrl}/ontology/commits`)
  await page.waitFor(`document.querySelectorAll('.commit-card').length > 1`, 30000)
  // the newest commit removed the trait: the one before has it
  await page.evaluate(`document.querySelectorAll('.commit-card')[1].querySelector('.btn-display').click()`)
  await page.waitFor(node(trait.id), 30000)
  await page.sleep(500)
  await page.evaluate(`${node(trait.id)}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await page.waitFor(`document.querySelector('.graph-modal .ontology-card .restore-entry')`, 15000)
  assert.match(flat(await page.text('.graph-modal .ontology-card')), /Phase \| REMOVED/i)

  await page.click('.graph-modal .ontology-card .restore-entry')
  await page.waitFor(`document.querySelector('.restore-modal .modal-buttons .btn-primary')`, 15000)
  assert.equal(flat(await page.text('.restore-modal h3')), `Restore Trait: ${TRAIT}`)
  await page.click('.restore-modal .modal-buttons .btn-primary')
  await page.waitFor(`document.querySelector('.restore-modal .success-message')`, 15000)

  assert.deepEqual(await phases(), { [subject.id]: 'DRAFT', [trait.id]: 'DRAFT' })
  await commit('E2E: the retired subject and trait are current again')
  assert.deepEqual(await phases(), { [subject.id]: 'ACTIVE', [trait.id]: 'ACTIVE' })
})
