// Legal references given as files (breedgraph 81961e6), chosen as a study's licence, which must be released at least as
// widely as the study and its datasets (breedgraph e3da216). Signed in as the writer, who curates the replicates study,
// released to registered users with its datasets. Afterwards the study's licence is put back and the references made
// here are deleted.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { replicates as r } from './lib/fixture.mjs'
import { pdfWithText } from './lib/documents.mjs'

const q = JSON.stringify
const STUDY = String(r.study.id)
const MARKDOWN = '# Licence\n\nUse the data **with credit**, and see [the full terms](https://example.org/terms).\n'

const studyLicence = async () => (await graphql(page,
  'query ($id: ID!) { programsStudy(id: $id) { result { licence { id description text textFormat filename fileId } } } }',
  { id: STUDY })).result.licence
const setLicence = async (licenceId) => {
  const payload = await graphql(page, 'mutation ($s: StudyUpdate!) { programsUpdateStudy(study: $s) { status errors { message } } }',
    { s: { id: STUDY, licenceId } })
  assert.equal(payload.status, 'SUCCESS', q(payload.errors))
}
const referencesDescribed = async (description) => (await graphql(page,
  'query ($d: String!) { referencesSearch(description: $d, referenceTypes: [LEGAL]) { result { id description } } }',
  { d: description })).result.filter((reference) => reference.description === description).map((reference) => reference.id)

let browser, page, originalLicenceId
const descriptions = []  // of the references made, to find and delete them afterwards

before(async () => {
  browser = await launchBrowser({ height: 1600 }); page = browser.page
  await loginAs(page, 'writer')
  originalLicenceId = (await studyLicence())?.id ?? null
})
after(async () => {
  try {
    await setLicence(originalLicenceId)
    const ids = (await Promise.all(descriptions.map(referencesDescribed))).flat()
    if (ids.length) await graphql(page, 'mutation ($ids: [ID!]!) { referencesDelete(ids: $ids) { status } }', { ids })
  } finally {
    await logout(page); await browser?.close()
  }
})

const programCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(r.program.name)})`
const studyCard = `${programCard}.querySelector('.study-card')`

async function openStudy () {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`${programCard}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.trials-header').click()`)
  await page.waitFor(`${programCard}.querySelector('.trial-card .studies-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.studies-header').click()`)
  await page.waitFor(`${studyCard}?.querySelector('.study-actions')`, 30000)
}

// Edit, then the licence's "+ Select Licence" or "Change", which opens the chooser at its legal reference form
async function openLicenceChooser () {
  await page.evaluate(`${studyCard}.querySelector('.study-actions button').click()`)
  await page.waitFor(`document.querySelector('.modal .reference-section')`)
  await page.evaluate(`[...document.querySelector('.modal .reference-section').querySelectorAll('button')]
    .find((b) => /Select Licence|Change/.test(b.innerText)).click()`)
  await page.waitFor(`document.querySelector('.modal-container .legal-reference-form')`)
}

const form = '.modal-container .legal-reference-form'
const releaseSelect = `${form} .control-selector .selector-item:nth-child(2) select`

// create the reference in the chooser, which in single mode chooses it and closes
async function create (description) {
  descriptions.push(description)
  await page.waitFor(`!document.querySelector(${q(`${form} .btn-primary`)}).disabled`)
  await page.click(`${form} .btn-primary`)
  await page.waitFor(`!document.querySelector('.modal-container') || document.querySelector(${q(`${form} .error-message`)})`, 30000)
}

async function submitStudy () {
  await page.click('.modal button[type=submit]')
  await page.waitFor(`!document.querySelector('.modal') || document.querySelector('.modal .error-message')`, 30000)
}

test('a licence given as a markdown file is read on upload and shown rendered with the study', async () => {
  await openStudy()
  const mark = page.mark()
  await openLicenceChooser()
  const description = uniqueName('E2E markdown licence ')
  await page.type(`${form} #legal-description`, description)
  await page.click(`${form} input[name=legal-source][value=file]`)
  await page.upload(`${form} #legal-file`, { name: 'licence.md', type: 'text/markdown', content: MARKDOWN })
  await page.type(releaseSelect, 'REGISTERED')
  await create(description)
  assert.equal(await page.evaluate(`document.querySelector('.modal .selected-item .item-description')?.innerText.trim()`), description,
    'the new licence is chosen')
  await submitStudy()
  assert.ok(!(await page.exists('.modal')), `the study is updated: ${await page.text('.modal .error-message')}`)

  const licence = await studyLicence()
  assert.deepEqual(
    { description: licence.description, textFormat: licence.textFormat, filename: licence.filename },
    { description, textFormat: 'MARKDOWN', filename: 'licence.md' }
  )
  assert.equal(licence.text, MARKDOWN.trim(), 'the text is read from the file')

  await openStudy()
  await page.waitFor(`${studyCard}.querySelector('.licence-display .reference-header')`, 30000)
  await page.evaluate(`${studyCard}.querySelector('.licence-display .reference-header').click()`)
  const shown = `${studyCard}.querySelector('.licence-display .legal-text')`
  await page.waitFor(`${shown}?.querySelector('.markdown h1')`, 15000)
  assert.equal(await page.evaluate(`${shown}.querySelector('.markdown h1').innerText.trim()`), 'Licence')
  assert.equal(await page.evaluate(`${shown}.querySelector('.markdown strong').innerText.trim()`), 'with credit')
  assert.equal(await page.evaluate(`${shown}.querySelector('.markdown a').getAttribute('href')`), 'https://example.org/terms')
  await page.waitFor(`${shown}.querySelector('.original-file')`, 15000)
  assert.match(await page.evaluate(`${shown}.querySelector('.original-file').innerText`), /Read from licence\.md/)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('a PDF licence is shown as its text', async () => {
  await openStudy()
  await openLicenceChooser()
  const description = uniqueName('E2E PDF licence ')
  await page.type(`${form} #legal-description`, description)
  await page.click(`${form} input[name=legal-source][value=file]`)
  await page.upload(`${form} #legal-file`, { name: 'licence.pdf', type: 'application/pdf', content: pdfWithText('Data licence\nUse with credit', 'Second page') })
  await page.type(releaseSelect, 'REGISTERED')
  await create(description)
  await submitStudy()

  const licence = await studyLicence()
  assert.equal(licence.textFormat, 'PLAIN')
  assert.equal(licence.text, 'Data licence\nUse with credit\n\nSecond page')
  await openStudy()
  await page.evaluate(`${studyCard}.querySelector('.licence-display .reference-header').click()`)
  await page.waitFor(`${studyCard}.querySelector('.licence-display .legal-text .plain')`, 15000)
  assert.equal(await page.evaluate(`${studyCard}.querySelector('.licence-display .legal-text .plain').innerText.trim()`),
    'Data licence\nUse with credit\n\nSecond page')
})

test('a file breedgraph cannot read is refused at once, saying why', async () => {
  await openStudy()
  await openLicenceChooser()
  await page.click(`${form} input[name=legal-source][value=file]`)
  await page.upload(`${form} #legal-file`, { name: 'licence.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: 'PK\u0003\u0004' })
  await create(uniqueName('E2E refused licence '))
  assert.match(await page.text(`${form} .error-message`), /\.txt, \.md or \.pdf/)
  await page.click('.modal-container .close-btn')
  await page.click('.modal .btn-secondary')
})

test('a licence released less widely than the study and its datasets is refused', async () => {
  await openStudy()
  await openLicenceChooser()
  const description = uniqueName('E2E private licence ')
  await page.type(`${form} #legal-description`, description)
  await page.type(`${form} #legal-text`, 'Use with credit.')
  await page.type(releaseSelect, 'PRIVATE')
  await create(description)
  await submitStudy()
  assert.match(await page.text('.modal .error-message'), /is released as PRIVATE, so it cannot be the licence of data released as REGISTERED/)
  await page.click('.modal .btn-secondary')
})

// The licence files uploaded above are among the writer's recent files, which a File tab leaves out: it offers recent
// file references only
test("the study's references offer as recent files only those of the File tab's type", async () => {
  await openStudy()
  await page.evaluate(`${studyCard}.querySelector('.study-actions button').click()`)
  await page.waitFor(`document.querySelector('.modal .reference-section')`)
  const mark = page.mark()
  // Manage, or Add References, beside the licence
  await page.evaluate(`[...document.querySelectorAll('.modal .reference-section')]
    .find((s) => s.querySelector('.section-label')?.innerText.trim() === 'References').querySelector('button').click()`)
  await page.waitFor(`document.querySelector('.modal-container .tabs')`)
  await page.evaluate(`[...document.querySelectorAll('.modal-container .tabs .tab')].find((t) => t.innerText.includes('File')).click()`)
  // the recent files are read as the modal opens
  for (let i = 0; i < 100 && !page.graphql(mark).some((r) => r.op === 'referencesRecentFiles'); i++) await page.sleep(100)
  await page.sleep(500)
  const recent = await page.evaluate(`[...document.querySelectorAll('.modal-container .recent-section .reference-item')].map((e) => e.innerText)`)
  assert.deepEqual(recent.filter((text) => descriptions.some((description) => text.includes(description))), [])
  await page.click('.modal-container .close-btn')
  await page.click('.modal .btn-secondary')
})
