// The ontology cites public references only (breedgraph 5ddb940, docs/read-access.md rule 10): signed in as the admin,
// an ontology admin who reads the scenario's legal references of every release, the commit form's licence chooser
// offers the public ones only. The others are listed but can't be chosen, and a licence made there is public. The form
// is cancelled, so nothing is committed. An entry's references are chosen the same way: the entry form is closed
// unsaved. The form starts with the current version's licence and copyright: that test commits a version citing the
// scenario's, which stays in the ontology's history.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

const q = JSON.stringify
const skip = e.reference_ontology_licence ? false : 'the test database has no public ontology licence: build it again (breedgraph docs/test-databases.md)'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page; await loginAs(page, 'admin') })
after(async () => {
  try { await logout(page) } finally { await browser?.close() }
})

const chooser = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim() === 'Select Licence')`
const tab = (label) => `[...${chooser}.querySelectorAll('.tabs .tab')].find((t) => t.innerText.includes(${q(label)}))`
const result = (name) => `[...${chooser}.querySelectorAll('.search-section .reference-item')].find((r) => r.querySelector('.reference-externalId')?.innerText.trim() === ${q(name)})`

test('the commit form\'s licence chooser offers public references only', { skip }, async () => {
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`[...document.querySelectorAll('.version-actions button')].some((b) => b.innerText.includes('Commit Changes'))`, 30000)
  await page.clickText('Commit Changes')
  await page.waitFor(`document.querySelector('.form-container h2')?.innerText.includes('Commit Ontology Version')`, 30000)
  // + Select Licence, or Change when the current version has one
  await page.evaluate(`document.querySelector('.form-container .reference-section button').click()`)
  await page.waitFor(`${chooser}?.querySelector('.modal-notice')`, 30000)
  assert.match(await page.evaluate(`${chooser}.querySelector('.modal-notice').innerText`), /must be public/)

  // a licence made here is public: the release is fixed
  await page.waitFor(`${chooser}.querySelector('.control-selector')`, 30000)
  const release = await page.evaluate(`(() => { const select = [...${chooser}.querySelectorAll('.control-selector select')].at(-1);
    return { value: select.value, fixed: [...select.options].every((o) => o.disabled) } })()`)
  assert.deepEqual(release, { value: 'PUBLIC', fixed: true })

  // of the scenario's legal references, those not public are listed but can't be chosen
  await page.evaluate(`${tab('Search')}.click()`)
  await page.waitFor(`${chooser}.querySelector('.search-input')`)
  await page.evaluate(`(() => { const input = ${chooser}.querySelector('.search-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Readpolicy');
    input.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  const names = [e.reference_registered.name, e.reference_legal_private.name, e.reference_ontology_licence.name]
  await page.waitFor(names.map((name) => `${result(name)}`).join(' && '), 30000)
  await page.waitFor(`![...${chooser}.querySelectorAll('.reference-note')].some((n) => n.innerText.includes('Checking'))`, 30000)
  const state = (name) => page.evaluate(`(() => { const item = ${result(name)};
    return { disabled: item.querySelector('.select-checkbox input').disabled, note: item.querySelector('.reference-note')?.innerText.trim() ?? null } })()`)
  assert.deepEqual(await state(e.reference_registered.name), { disabled: true, note: 'Registered: only public references can be chosen' })
  assert.deepEqual(await state(e.reference_legal_private.name), { disabled: true, note: 'Private: only public references can be chosen' })
  assert.deepEqual(await state(e.reference_ontology_licence.name), { disabled: false, note: null })

  // the public one is chosen, closing the chooser
  await page.evaluate(`${result(e.reference_ontology_licence.name)}.querySelector('.select-checkbox input').click()`)
  await page.waitFor(`!(${chooser})`, 15000)
  const chosen = await page.evaluate(`document.querySelector('.form-container .selected-item .item-description')?.innerText.trim() ?? null`)
  assert.equal(chosen, e.reference_ontology_licence.name)

  await page.evaluate(`document.querySelector('.form-container .btn-cancel').click()`)
  await page.waitFor(`!document.querySelector('.form-container')`, 15000)
})

test('the commit form starts with the current version\'s licence and copyright', { skip }, async () => {
  const [licence, copyright] = [e.reference_ontology_licence, e.reference_ontology_copyright]
  const payload = await graphql(page, `mutation ($licence: ID, $copyright: ID, $comment: String) {
    ontologyCommitVersion(versionChange: PATCH, comment: $comment, licenceId: $licence, copyrightId: $copyright) { status errors { message } } }`,
  { licence: String(licence.id), copyright: String(copyright.id), comment: 'E2E: a licence and copyright the next commit starts with' })
  assert.equal(payload.status, 'SUCCESS', JSON.stringify(payload.errors))

  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`[...document.querySelectorAll('.version-actions button')].some((b) => b.innerText.includes('Commit Changes'))`, 30000)
  await page.clickText('Commit Changes')
  await page.waitFor(`document.querySelector('.form-container .reference-section')`, 30000)
  const sections = await page.evaluate(`[...document.querySelectorAll('.form-container .reference-section')].map((section) => ({
    label: section.querySelector('.section-label').innerText.trim(),
    chosen: section.querySelector('.selected-item .item-description')?.innerText.trim() ?? null
  }))`)
  assert.deepEqual(sections, [
    { label: 'Licence (Optional)', chosen: licence.name },
    { label: 'Copyright (Optional)', chosen: copyright.name }
  ])
  await page.evaluate(`document.querySelector('.form-container .btn-cancel').click()`)
  await page.waitFor(`!document.querySelector('.form-container')`, 15000)
})

test('an entry\'s references are chosen as public ones', { skip }, async () => {
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`document.querySelector('.entry-buttons .entry-btn')`, 30000)
  await page.evaluate(`document.querySelector('.entry-buttons .entry-btn').click()`)
  await page.waitFor(`document.querySelector('.references-section .references-help')`, 30000)
  assert.match(await page.text('.references-section .references-help'), /Public references only/)
  await page.clickText('Manage References')
  const references = `[...document.querySelectorAll('.modal-container')].find((m) => m.querySelector('.modal-header h2')?.innerText.trim() === 'Manage References')`
  await page.waitFor(`${references}?.querySelector('.modal-notice') && ${references}.querySelector('.control-selector')`, 30000)
  assert.match(await page.evaluate(`${references}.querySelector('.modal-notice').innerText`), /must be public/)
  const release = await page.evaluate(`(() => { const select = [...${references}.querySelectorAll('.control-selector select')].at(-1);
    return { value: select.value, fixed: [...select.options].every((o) => o.disabled) } })()`)
  assert.deepEqual(release, { value: 'PUBLIC', fixed: true })

  await page.evaluate(`${references}.querySelector('.close-btn').click()`)
  await page.waitFor(`!(${references})`, 15000)
  await page.evaluate(`document.querySelector('.modal-container .close-btn').click()`)
  await page.waitFor(`!document.querySelector('.references-section')`, 15000)
})
