// The curation table: a record's 🔒 opens its dataset's controller in full, with its controls and writes, for a
// signed-in user, who reads the record; a visitor is shown no controllers and none is asked for.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'
import { entity, concept, licences } from './lib/fixture.mjs'

let browser, page
const q = JSON.stringify

before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page })
after(async () => { await browser?.close() })

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim().startsWith(${q(label)}))`

// Open curation from the programs page and choose a study through its program and trial, and a variable
async function curate (path, study, variable) {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  for (const label of path) {
    await page.waitFor(`${levelLoaded} && ${option(label)}?.querySelector('.expand-button')`, 60000)
    await page.evaluate(`${option(label)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
  }
  await page.waitFor(`${levelLoaded} && ${option(study)}?.querySelector('.option-checkbox')`, 60000)
  await page.evaluate(`${option(study)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 120000)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]'); [...s.options].forEach((o) => { o.selected = o.text.trim() === ${q(variable)} }); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  // a licensed study's licence, accepted when asked for, as a visitor must
  await page.sleep(1000)
  if (await page.exists('input[name=licencesAgreed]')) {
    await page.check('input[name=licencesAgreed]', true)
    await page.click('.licence-agreement button.accept-licences')
    await page.waitFor(`!document.querySelector('input[name=licencesAgreed]')`, 30000)
  }
  const loadTable = `[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table'))`
  await page.waitFor(`!${loadTable}.disabled`, 30000)
  await page.evaluate(`${loadTable}.click()`)
  await page.waitFor(`document.querySelector('.curation-table tbody tr td')`, 120000)
  await page.sleep(1000)
}

const publicStudy = () => curate([entity('program').name, entity('trial').name], entity('study_public').name, concept)
const controllerModal = `[...document.querySelectorAll('.modal')].find((m) => m.innerText.includes('Controller Details'))`

test("a record's 🔒 shows its dataset's controller, with its controls and writes", async () => {
  await loginAs(page, 'writer')
  try {
    await publicStudy()
    await page.waitFor(`document.querySelector('.controller-badge-mini')`)
    await page.evaluate(`document.querySelector('.controller-badge-mini').click()`)
    await page.waitFor(`${controllerModal}?.innerText.includes('Write History')`, 20000)
    const text = await page.evaluate(`${controllerModal}.innerText`)
    assert.ok(text.includes('Controls:'), 'the controls are shown')
    assert.ok(!text.includes("You can't read this record"), 'the record is not taken for one the writer cannot read')
  } finally {
    await logout(page)
  }
})

test('a visitor is shown no controllers, and none is asked for', async () => {
  const mark = page.mark()
  // the licensed study is public, through its program and trial, as study_public's are not
  await curate([licences.program.name, licences.trial.name], licences.studies.public.name, concept)
  assert.equal(await page.evaluate(`document.querySelectorAll('.controller-badge-mini').length`), 0)
  const controllerRequests = page.graphql(mark).filter((request) => request.op.startsWith('controlsController'))
  assert.deepEqual(controllerRequests, [], 'no controller is asked for')
})
