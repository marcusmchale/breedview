// A study, and its datasets, can be released beyond the teams that hold them only once the study has a licence
// (breedgraph docs/licences.md §1), and the licence pickers offer the standard licences first, fixed, so that no one
// can change them (§6, docs/read-access.md rule 11). Signed in as the admin, who has every access to the root team: a
// study made here in the public trial, private and without a licence, is refused a wider release until it has the
// standard CC BY 4.0. The study is deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const NAME = uniqueName('E2E licence on release ')
const CC_BY = 'Creative Commons Attribution 4.0 International (CC BY 4.0)'
const CC0 = 'Creative Commons CC0 1.0 Universal (CC0 1.0), a public domain dedication'

let browser, page, studyId

const studyLicence = async () => (await graphql(page,
  'query ($id: ID!) { programsStudy(id: $id) { result { licence { id description } } } }', { id: studyId })).result.licence

before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'admin')
  const created = await graphql(page, `mutation ($s: StudyInput!, $team: ID!) {
    programsCreateStudy(study: $s, controlTeamId: $team, release: PRIVATE) { status errors { message } } }`,
  { s: { trialId: String(e.trial_public.id), name: NAME }, team: String(teams.root.id) })
  assert.equal(created.status, 'SUCCESS', q(created.errors))
  const trial = await graphql(page, 'query ($id: ID!) { programsTrial(id: $id) { result { studies { id name } } } }',
    { id: String(e.trial_public.id) })
  studyId = trial.result.studies.find((study) => study.name === NAME).id
})
after(async () => {
  try {
    if (studyId) {
      await graphql(page, `mutation ($label: ControlledModelLabel!, $ids: [ID!]!) {
        controlsSetRelease(entityLabel: $label, entityIds: $ids, release: PRIVATE) { status } }`, { label: 'STUDY', ids: [studyId] })
      await graphql(page, 'mutation ($id: ID!) { programsDeleteStudy(id: $id) { status } }', { id: studyId })
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

const programCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(e.program_public.name)})`
const trialCard = `${programCard}.querySelector('.trial-card')`
const studyCard = `[...${programCard}.querySelectorAll('.study-card')].find((c) => c.querySelector('.study-title-section strong')?.innerText.trim() === ${q(NAME)})`

async function openTrial () {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`${programCard}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.trials-header').click()`)
  await page.waitFor(`${trialCard}?.querySelector('.studies-header')`, 30000)
}

async function openStudy () {
  await openTrial()
  await page.evaluate(`${trialCard}.querySelector('.studies-header').click()`)
  await page.waitFor(`${studyCard}?.querySelector('.study-actions')`, 30000)
}

test('a study without a licence is refused a release beyond its team', async () => {
  await openStudy()
  await page.waitFor(`${studyCard}.querySelector('button.controller-badge:not(:disabled)')`, 30000)
  await page.evaluate(`${studyCard}.querySelector('button.controller-badge').click()`)
  await page.waitFor(`document.querySelector('.release-badge.clickable')`, 30000)
  await page.evaluate(`document.querySelector('.release-badge.clickable').click()`)
  await page.waitFor(`document.querySelector('#release-select')`)
  await page.type('#release-select', 'REGISTERED')
  // what releasing means is in the Terms of Use, which the note links to
  await page.waitFor(`document.querySelector('.release-form .release-terms-note a')`, 10000)
  assert.equal(await page.evaluate(`document.querySelector('.release-form .release-terms-note a').getAttribute('href')`), '/terms')
  await page.clickText('Update Release')
  await page.waitFor(`document.querySelector('.release-form .error-message')`, 30000)
  assert.match(await page.text('.release-form .error-message'), new RegExp(`Study ${studyId} has no licence`))
  assert.equal((await graphql(page, `query ($ids: [ID!]!) { controlsControllers(entityLabel: STUDY, entityIds: $ids) {
    result { release } } }`, { ids: [studyId] })).result[0].release, 'PRIVATE')
})

test('the licence chooser offers the standard licences first, fixed, and a study with one can be released', async () => {
  await openStudy()
  const mark = page.mark()
  await page.evaluate(`[...${studyCard}.querySelectorAll('.study-actions button')].find((b) => b.innerText.trim() === 'Edit').click()`)
  await page.waitFor(`document.querySelector('.modal .reference-section')`, 30000)
  assert.match(await page.text('.modal .reference-section .section-help'), /Needed before the study, or its datasets, is released/)
  await page.clickText('+ Select Licence')
  const chooser = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim() === 'Select Licence')`
  await page.waitFor(`${chooser}?.querySelector('.standard-licences .reference-item')`, 30000)
  const standard = `[...${chooser}.querySelectorAll('.standard-licences .reference-item')]`
  assert.deepEqual(await page.evaluate(`${standard}.map((item) => item.querySelector('.reference-externalId').innerText.trim())`), [CC_BY, CC0])

  // a standard licence is fixed: its badge says so, and opens nothing to change it
  await page.evaluate(`${standard}[0].querySelector('.reference-header').click()`)
  await page.waitFor(`${standard}[0].querySelector('.fixed-badge')`, 30000)
  assert.equal(await page.evaluate(`${standard}[0].querySelector('.fixed-badge').innerText.trim()`), 'PUBLIC · fixed')
  assert.equal(await page.evaluate(`!!${standard}[0].querySelector('button.controller-badge')`), false)

  // chosen, it closes the chooser, and the study keeps it
  await page.evaluate(`${standard}[0].querySelector('.select-checkbox input').click()`)
  await page.waitFor(`!(${chooser})`, 15000)
  assert.equal(await page.evaluate(`document.querySelector('.modal .selected-item .item-description')?.innerText.trim()`), CC_BY)
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal') || document.querySelector('.modal .error-message')`, 30000)
  assert.ok(!(await page.exists('.modal')), `the study is updated: ${await page.text('.modal .error-message')}`)
  assert.equal((await studyLicence())?.description, CC_BY)

  const released = await graphql(page, `mutation ($label: ControlledModelLabel!, $ids: [ID!]!) {
    controlsSetRelease(entityLabel: $label, entityIds: $ids, release: REGISTERED) { status errors { message } } }`,
  { label: 'STUDY', ids: [studyId] })
  assert.equal(released.status, 'SUCCESS', q(released.errors))
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('creating a study released beyond the team asks for a licence first', async () => {
  await openTrial()
  await page.evaluate(`[...${trialCard}.querySelectorAll('.trial-actions button')].find((b) => b.innerText.trim() === 'Create Study').click()`)
  await page.waitFor(`document.querySelector('.modal input[name=name]')`, 30000)
  await page.type('.modal input[name=name]', uniqueName('E2E refused study '))
  const release = '.modal .form-actions .control-selector .selector-item:nth-child(2) select'
  await page.type(release, 'REGISTERED')
  await page.waitFor(`document.querySelector('.modal .form-actions .release-terms-note')`, 10000)
  await page.click('.modal button[type=submit]')
  await page.waitFor(`document.querySelector('.modal .error-message')`, 15000)
  assert.match(await page.text('.modal .error-message'), /needs a licence/)
  await page.evaluate(`[...document.querySelectorAll('.modal .form-actions button')].find((b) => b.innerText.trim() === 'Cancel').click()`)
  await page.waitFor(`!document.querySelector('.modal')`, 15000)
})
