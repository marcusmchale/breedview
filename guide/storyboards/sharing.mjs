// Chapter 8, "Sharing results with a partner" (src/guide/chapters/sharing.md), from a fresh load of the demonstration
// database (manifest workflows.sharing): Bridget gives North Field Yield Trial 2025 the Partner Data Licence and raises
// the study, its trial and its field plan to Registered; Dara releases its datasets and plots through Bulk control;
// Petra then finds the study, and accepts the licence before reading its data.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { byText, loadStudyData, navLink, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify
const breedgraph = fileURLToPath(new URL('../../../breedgraph/', import.meta.url))

export const meta = {
  chapter: 'sharing',
  // the study's curator, signed in off camera
  account: 'bridget'
}

export async function check ({ manifest }) {
  const sharing = manifest.workflows?.sharing
  if (!sharing) throw new Error('The build has no sharing workflow')
  for (const key of [sharing.study, sharing.trial, sharing.field_plan, ...sharing.datasets]) {
    if (manifest.entities[key]?.release !== 'PRIVATE') throw new Error(`${key} is not private, as the build has it`)
  }
}

// In Bulk control, what is chosen set to Registered, through the actions bar and its confirm
async function setRegistered (page, input) {
  await input.choose('document.querySelector("select[name=bulkRelease]")', 'Registered')
  const setRelease = byText('button', 'Set release')
  await input.click(setRelease)
  await input.confirm(setRelease)
  await page.waitFor(`document.querySelector('.action-message')?.innerText.endsWith('to Registered') || document.querySelector('.bulk-actions ~ .error-message')`, 60000)
  const error = await page.evaluate(`document.querySelector('.bulk-actions ~ .error-message')?.innerText ?? null`)
  if (error) throw new Error(`Bulk release refused: ${error}`)
  await input.pause(2500)
}

// In a record's controller window, its release set to Registered
async function releaseToRegistered (page, input, badge) {
  await input.click(badge)
  await page.waitFor(`document.querySelector('.release-badge.clickable')`, 15000)
  await input.pause(800)
  await input.click('document.querySelector(".release-badge.clickable")')
  await page.waitFor(`document.querySelector('#release-select')`, 10000)
  await input.choose('document.querySelector("#release-select")', 'Registered')
  await input.click(byText('.release-form button', 'Update Release'))
  await page.waitFor(`document.querySelector('.release-form .success-message, .release-form .error-message')`, 15000)
  const error = await page.evaluate(`document.querySelector('.release-form .error-message')?.innerText ?? null`)
  if (error) throw new Error(`Release refused: ${error}`)
  await input.pause(1200)
  await input.click('document.querySelector(".modal-close")')
  await page.waitFor(`!document.querySelector('.release-form')`, 10000)
  await input.pause(500)
}

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  // the 2025 trial's area, holding the plots its datasets are recorded on
  const sharing = { ...manifest.workflows.sharing, area: 'unit:North Field 2025 trial area' }
  const name = (key) => manifest.entities[key].name
  const where = { programme: name('programme'), trial: name(sharing.trial), study: name(sharing.study) }
  const licence = manifest.uploads[sharing.licence_upload]
  const signInAs = (who) => recorder.offCamera(async () => {
    await session.logout(page)
    await session.login(page, who.username, who.password)
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
  }, { label: `Signed in as ${who.fullname}` })

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  let cards
  await step('licence', async () => {
    cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.study-actions button')`)
    await page.waitFor(`document.querySelector('.modal .reference-section')`, 15000)
    await input.pause(800)
    await input.click(`[...document.querySelector('.modal .reference-section').querySelectorAll('button')].find((b) => /Select Licence/.test(b.innerText))`)
    const form = '.modal-container .legal-reference-form'
    await page.waitFor(`document.querySelector(${q(form)})`, 15000)
    await input.pause(800)
    await input.type(`document.querySelector(${q(`${form} #legal-description`)})`, licence.description)
    await input.click(`document.querySelector(${q(`${form} input[name=legal-source][value=file]`)})`)
    await input.chooseFile(`document.querySelector(${q(`${form} #legal-file`)})`, join(breedgraph, licence.path))
    await input.choose(`document.querySelector(${q(`${form} .control-selector .selector-item:nth-child(2) select`)})`, 'Registered')
    await input.pause(600)
    await page.waitFor(`!document.querySelector(${q(`${form} .btn-primary`)}).disabled`, 30000)
    await input.click(`document.querySelector(${q(`${form} .btn-primary`)})`)
    await page.waitFor(`!document.querySelector('.modal-container') || document.querySelector(${q(`${form} .error-message`)})`, 30000)
    await input.pause(1200)
    await input.click('document.querySelector(".modal button[type=submit]")')
    await page.waitFor(`!document.querySelector('.modal') || document.querySelector('.modal .error-message')`, 30000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The study was not saved: ${error}`)
    await input.pause(1500)
  })

  await step('release', async () => {
    await releaseToRegistered(page, input, `${cards.studyCard}.querySelector('.controller-badge')`)
    await releaseToRegistered(page, input, `${cards.trialCard}.querySelector('.controller-badge')`)
    // the field plan, among the study's references
    await input.click(`${cards.studyCard}.querySelector('.references-display .references-header')`)
    const plan = `[...${cards.studyCard}.querySelectorAll('.reference-item')].find((r) => r.querySelector('.reference-externalId')?.innerText.trim() === ${q(name(sharing.field_plan))})`
    await page.waitFor(plan, 15000)
    await input.click(`(${plan}).querySelector('.reference-header .expand-icon')`)
    await page.waitFor(`(${plan}).querySelector('.reference-details .controller-badge')`, 15000)
    await releaseToRegistered(page, input, `(${plan}).querySelector('.reference-details .controller-badge')`)
  })

  await signInAs(manifest.accounts[sharing.releaser])

  await step('bulk', async () => {
    await input.click(navLink('Access control'))
    await page.waitFor(byText('.page-tab', 'Bulk control'), 30000)
    await input.click(byText('.page-tab', 'Bulk control'))
    await page.waitFor(`document.querySelector('select[name=bulkTeam]')`, 30000)
    await input.choose('document.querySelector("select[name=bulkTeam]")', manifest.teams.field.name)
    await page.waitFor(`document.querySelector('.counts-table tr[data-label=DATASET] th button')`, 30000)
    await input.pause(1500)
    await input.click('document.querySelector(".counts-table tr[data-label=DATASET] th button")')
    await page.waitFor(`document.querySelector('.controlled-table tbody tr td input')`, 30000)
    await input.pause(1000)
    for (const key of sharing.datasets) {
      const row = `[...document.querySelectorAll('.controlled-table tbody tr')].find((tr) => tr.innerText.includes(${q(`#${manifest.entities[key].id}`)}))`
      await input.click(`(${row}).querySelector('input')`)
    }
    await input.pause(800)
    await setRegistered(page, input)
    // and the plots the data is recorded on: the trial's area, with the units below it Field Operations controls
    await input.click('document.querySelector(".counts-table tr[data-label=UNIT] th button")')
    const area = `document.querySelector('.unit-row[data-unit-id="${manifest.entities[sharing.area].id}"]')`
    await page.waitFor(area, 30000)
    await input.pause(1000)
    await input.click(`${area}.querySelector('input')`)
    await page.waitFor(`document.querySelector('.selection-description')?.innerText.includes('units')`, 30000)
    await input.pause(800)
    await setRegistered(page, input)
  })

  await signInAs(manifest.accounts[sharing.partner])

  await step('partner', async () => {
    cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.scroll(null, 380)
    await input.pause(2500)
  })

  await step('accept', async () => {
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.view-datasets')`, 30000)
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.view-datasets')`)
    await loadStudyData({ page, input })
    await input.pause(3500)
  })
}
