// Study licences, accepted before a dataset's data is loaded or analysed (breedgraph docs/licences.md §5). The public
// study is given a public markdown licence through the API, as the writer, whose team controls the study, so is never
// asked; the outsider, who reads its public dataset by release, accepts the licence in curation, and it holds after
// the page is loaded again and in the analysis editor. Afterwards the study's licence is put back and the licence made
// here is deleted.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { entities as e, teams, concept } from './lib/fixture.mjs'

const q = JSON.stringify
const STUDY = String(e.study_public.id)
const DATASET = String(e.dataset_public.id)
const DESCRIPTION = uniqueName('E2E data licence ')

let browser, page, licenceId, originalLicenceId

const setLicence = async (id) => {
  const payload = await graphql(page, 'mutation ($s: StudyUpdate!) { programsUpdateStudy(study: $s) { status errors { message } } }',
    { s: { id: STUDY, licenceId: id } })
  assert.equal(payload.status, 'SUCCESS', q(payload.errors))
}
const datasetLicence = async () => (await graphql(page,
  'query ($ids: [ID!]) { datasets(ids: $ids) { result { licenceRequired licence { id accepted } } } }', { ids: [DATASET] })).result[0]

before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await loginAs(page, 'writer')
  originalLicenceId = (await graphql(page, 'query ($id: ID!) { programsStudy(id: $id) { result { licence { id } } } }', { id: STUDY })).result.licence?.id ?? null
  const created = await graphql(page,
    'mutation ($r: LegalReferenceInput!, $team: ID!) { referencesCreateLegal(reference: $r, controlTeamId: $team, release: PUBLIC) { status result errors { message } } }',
    { r: { description: DESCRIPTION, text: '# Data licence\n\nUse the data **with credit**.', textFormat: 'MARKDOWN' }, team: String(teams.child.id) })
  assert.equal(created.status, 'SUCCESS', q(created.errors))
  licenceId = String(created.result)
  await setLicence(licenceId)
})
after(async () => {
  try {
    await logout(page)
    await loginAs(page, 'writer')
    await setLicence(originalLicenceId)
    if (licenceId) await graphql(page, 'mutation ($ids: [ID!]!) { referencesDelete(ids: $ids) { status } }', { ids: [licenceId] })
  } finally {
    await logout(page); await browser?.close()
  }
})

const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const optionNamed = (label) => `[...document.querySelectorAll('.options-list .option-label')].find((e) => e.innerText.trim().startsWith(${q(label)})).closest('.option-item')`

// Curate, then the study at the end of path (the program and trial as the user sees them), and its height variable
async function curate (path) {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  for (const label of path.slice(0, -1)) {
    await page.evaluate(`${optionNamed(label)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 60000)
  }
  await page.evaluate(`${optionNamed(path.at(-1))}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 60000)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]');
    [...s.options].find((o) => o.innerText.trim() === ${q(concept)}).selected = true;
    s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  await page.sleep(1500) // the licences of the datasets to load are read
}

const loadTable = `[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table'))`

test("the writer, whose team controls the study, loads its data without being asked for the licence", async () => {
  assert.equal((await datasetLicence()).licenceRequired, false)
  await curate([e.program.name, e.trial.name, e.study_public.name])
  assert.ok(!(await page.exists('.licence-agreement')), 'no licence to accept')
  assert.equal(await page.evaluate(`${loadTable}.disabled`), false)
})

test('the outsider accepts the licence before loading the data, and it holds afterwards', async () => {
  await logout(page)
  await loginAs(page, 'outsider')
  assert.deepEqual(await datasetLicence(), { licenceRequired: true, licence: { id: licenceId, accepted: false } })
  const mark = page.mark()
  // the program and trial are hidden from the outsider, so placeholders
  await curate(['REDACTED', 'REDACTED', e.study_public.name])

  await page.waitFor(`document.querySelector('.licence-agreement .legal-text .markdown h1')`, 30000)
  assert.equal(await page.text('.licence-agreement .licence-title'), DESCRIPTION)
  assert.equal(await page.text('.licence-agreement .markdown h1'), 'Data licence')
  assert.equal(await page.text('.licence-agreement .markdown strong'), 'with credit')
  assert.equal(await page.evaluate(`${loadTable}.disabled`), true, 'Load Table waits for the licence')
  assert.equal(await page.evaluate(`document.querySelector('.licence-agreement .accept-licences').disabled`), true, 'Accept waits for the box')

  await page.check('.licence-agreement input[name=licencesAgreed]')
  await page.click('.licence-agreement .accept-licences')
  await page.waitFor(`!document.querySelector('.licence-agreement') && !${loadTable}.disabled`, 30000)
  await page.evaluate(`${loadTable}.click()`)
  await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 60000)
  assert.deepEqual(await page.graphqlErrors(mark), [], 'no request was refused')

  // accepted for this account, from this browser: loading the page again doesn't ask again
  assert.deepEqual(await datasetLicence(), { licenceRequired: true, licence: { id: licenceId, accepted: true } })
  await curate(['REDACTED', 'REDACTED', e.study_public.name])
  assert.ok(!(await page.exists('.licence-agreement')))
  assert.equal(await page.evaluate(`${loadTable}.disabled`), false)

  // nor does the analysis editor, for the same dataset
  await page.goto(`${config.appUrl}/analysis?study=${STUDY}&datasets=${DATASET}`)
  await page.waitFor(`document.querySelector('.submit-bar')`, 30000)
  await page.sleep(1500)
  assert.ok(!(await page.exists('.submit-bar .licence-agreement')))
})

test('signed out, a visitor is asked again: acceptances are kept for whoever accepted them', async () => {
  await logout(page)
  assert.deepEqual(await datasetLicence(), { licenceRequired: true, licence: { id: licenceId, accepted: false } })
})
