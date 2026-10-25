// Chapter 17, "Looking after the ontology" (src/guide/chapters/looking-after-the-ontology.md), independent (manifest
// workflows.ontology): Dara, the ontology's admin, makes Theo an editor, as he asked; deprecates the Fungicide programme
// factor and commits the major version that removes it; finds it marked retired on the 2024 study that recorded it; and
// restores it from there, as a draft. Plays from a fresh load of the demonstration database.
import { byText, commitReference, navLink, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'looking-after-the-ontology',
  // the ontology's admin, signed in off camera
  account: 'dara'
}

const REQUESTS = 'query { ontologyRoleRequests { result { name ontologyRole ontologyRoleRequested } } }'

export async function check ({ page, session, manifest }) {
  const plan = manifest.workflows?.ontology
  if (!plan) throw new Error('The build has no ontology workflow')
  const asker = manifest.accounts[plan.role_request].username
  const { result } = await session.graphql(page, REQUESTS)
  if (!result.some((user) => user.name === asker && user.ontologyRoleRequested === 'EDITOR' && user.ontologyRole !== 'EDITOR')) {
    throw new Error(`${asker} has no pending request to be an editor: load the dump again`)
  }
}

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.workflows.ontology
  const asker = manifest.accounts[plan.role_request].username
  const factor = 'Fungicide programme'
  const where = {
    programme: manifest.entities.programme.name,
    trial: manifest.entities.trial_2024.name,
    study: manifest.entities.study_2024.name
  }
  const askerRow = `[...document.querySelectorAll('.role-requests-container .table-row')].find((r) => r.querySelector('.user-name')?.innerText.trim() === ${q(asker)})`
  const node = `[...document.querySelectorAll('g.node')].find((g) => g.__data__?.name === ${q(factor)})?.querySelector('circle')`

  await recorder.hold(async () => {
    await page.goto(`${app}/ontology`)
    await page.waitFor(`${byText('button', 'Manage Roles')} && document.querySelector('.latest-commit-info')`, 30000)
    await page.sleep(2000)
  })
  await input.restoreCursor()

  await step('roles', async () => {
    await input.click(byText('button', 'Manage Roles'))
    await page.waitFor(`${askerRow}?.querySelector('.btn-set-role')`, 30000)
    await input.pause(1200)
    await input.hover(`(${askerRow}).querySelector('.col-requested')`, 2000)
    await input.click(`(${askerRow}).querySelector('.btn-set-role')`)
    await page.waitFor(`document.querySelector('.modal-content .roles-grid')`, 10000)
    await input.pause(800)
    await input.click(byText('.modal-content .role-button', 'Editor'))
    await input.pause(600)
    await input.click(byText('.modal-content .modal-footer button', 'Set Role'))
    await page.waitFor(`!document.querySelector('.modal-content .roles-grid')`, 15000)
    // now among the editors
    const editors = `[...document.querySelectorAll('.role-requests-container')].find((c) => c.querySelector('h2')?.innerText.trim() === 'Editors')`
    const fullname = manifest.accounts[plan.role_request].fullname
    await page.waitFor(`[...((${editors})?.querySelectorAll('.user-name') ?? [])].some((n) => n.innerText.trim() === ${q(fullname)})`, 15000)
    await input.pause(800)
    await input.hover(`(${editors}).querySelector('.users-table')`, 2500)
  })

  await step('deprecate', async () => {
    await input.click(navLink('Ontology'))
    await page.waitFor(`document.querySelector('.search-box .search-input')`, 30000)
    await input.pause(2000)
    await input.type('document.querySelector(".search-box .search-input")', factor)
    await page.waitFor(byText('.search-result-item .result-name', factor), 15000)
    await input.click(byText('.search-result-item .result-name', factor))
    await input.pause(1500)
    await input.click(node)
    await page.waitFor(`document.querySelector('.card-container button')`, 15000)
    await input.pause(800)
    await input.click(byText('.card-container button', '✏️ Edit'))
    await page.waitFor(byText('.modal-container .form-actions button', 'Deprecate'), 15000)
    await input.pause(800)
    await input.click(byText('.modal-container .form-actions button', 'Deprecate'))
    await page.waitFor(`document.querySelector('.lifecycle-panel')`, 10000)
    await input.pause(800)
    await input.hover('document.querySelector(".lifecycle-panel")', 3500)
    await input.click('document.querySelector(".lifecycle-panel .btn-danger")')
    await page.waitFor(`!document.querySelector('.modal-container')`, 15000)
    await input.pause(1200)
  })

  await step('commit', async () => {
    await input.scroll(null, -600, { at: { x: 1262, y: 400 } })
    await input.click(byText('.btn-version', 'Commit Changes'))
    await page.waitFor(`document.querySelector('.form-modal select[name=versionChange]')`, 15000)
    await input.pause(800)
    await input.choose('document.querySelector(".form-modal select[name=versionChange]")', 'MAJOR')
    await input.type('document.querySelector(".form-modal textarea[name=comment]")', 'Retire the fungicide programme, which the trials no longer record')
    await commitReference({ page, input, button: 'Select Licence', description: 'Example Ontology Licence' })
    await commitReference({ page, input, button: 'Select Copyright', description: 'Example Ontology Copyright' })
    await input.click('document.querySelector(".form-modal button[type=submit]")')
    await page.waitFor(`!document.querySelector('.form-modal')`, 30000)
    await page.waitFor(`document.querySelector('.latest-commit-info')?.innerText.includes('Retire the fungicide')`, 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".latest-commit-info")', 2500)
  })

  let cards
  await step('retired', async () => {
    cards = await openStudy({ page, input, ...where })
    await input.pause(800)
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    const tag = `${cards.studyCard}?.querySelector('.retired-tag')`
    await page.waitFor(tag, 30000)
    await input.pause(1000)
    await input.hover(`(${tag}).closest('.chip')`, 3500)
    recorder.poster()
  })

  await step('restore', async () => {
    await input.click(`${cards.studyCard}.querySelector('.retired-tag')`)
    await page.waitFor(`document.querySelector('.restore-modal .modal-buttons .btn-primary')`, 15000)
    await input.pause(1000)
    await input.hover('document.querySelector(".restore-modal")', 2500)
    await input.click('document.querySelector(".restore-modal .modal-buttons .btn-primary")')
    await page.waitFor(`document.querySelector('.restore-modal .success-message')`, 15000)
    await input.pause(1000)
    await input.hover('document.querySelector(".restore-modal .success-message")', 2500)
    await input.click('document.querySelector(".restore-modal .modal-buttons .btn-secondary")')
    await page.waitFor(`!document.querySelector('.restore-modal')`, 15000)
    await input.pause(1500)
  })
}
