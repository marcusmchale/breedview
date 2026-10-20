// Every routed page renders for a signed-in user without console errors.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout } from './lib/app.mjs'
import { entities as e } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser(); page = browser.page; await login(page, config.adminUser, config.adminPassword) })
after(async () => { await logout(page); await browser?.close() })

const pages = [
  ['/people', 'People'], ['/access', 'Bulk control[\\s\\S]*Transfer offers[\\s\\S]*What a team you administer controls'],
  ['/ontology', ''], ['/germplasm', ''], ['/locations', 'Register a location tree'],
  ['/programs', 'View & curate datasets'], ['/analysis', ''], ['/profile', 'Your profile[\\s\\S]*Teams[\\s\\S]*Create a team tree'],
  ['/privacy', '[Pp]rivacy notice']
]

for (const [path, expected] of pages) {
  test(`${path} renders`, async () => {
    const mark = page.mark()
    await page.goto(`${config.appUrl}${path}`)
    await page.sleep(2500)
    assert.ok((await page.url()).endsWith(path), `stays on ${path} (not redirected to login)`)
    if (expected) assert.match(await page.text('main'), new RegExp(expected), `shows "${expected}"`)
    assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  })
}

// The dataset submission mounts its table as soon as a study is chosen, so it must open without errors
test('the dataset submission opens for the first study', async () => {
  // the first study of the programs page: open the trials and studies of each program until one is listed
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
  await page.sleep(1000)
  await page.evaluate(`document.querySelectorAll('.trials-header').forEach((e) => e.click())`)
  await page.waitFor(`document.querySelector('.trial-card .studies-header')`, 30000)
  await page.sleep(500)
  await page.evaluate(`document.querySelectorAll('.studies-header').forEach((e) => e.click())`)
  await page.waitFor(`document.querySelector('.study-card .section-toggle')`, 30000)
  await page.evaluate(`[...document.querySelector('.study-card').querySelectorAll('.section-toggle')].find((b) => b.innerText.includes('Datasets')).click()`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.includes('Create New Dataset'))`, 30000)
  const mark = page.mark()
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('Create New Dataset')).click()`)
  await page.waitFor(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger').length >= 2`, 30000)
  await page.sleep(1000)
  assert.match(await page.text('body'), /Create New Dataset[\s\S]*Study:/, 'the submission form shows the study')
  // the table mounts once a location, a unit and a concept are chosen: the test database's field, which holds blocks,
  // and the first unit there
  const optionIndex = (label) => `[...document.querySelectorAll('.options-list .option-item')].findIndex((o) => o.querySelector('.option-label')?.innerText.trim() === ${JSON.stringify(label)})`
  const pick = async (index, what, path = [], target = null) => {
    await page.evaluate(`document.querySelectorAll('.modal-overlay .hierarchical-multiselect .select-trigger')[${index}].click()`)
    await page.waitFor(`document.querySelector('.options-list .option-label')`, 30000)
    // follow the path, or the first entry, down until the target is listed, or to the bottom of the tree
    for (let level = 0; level < 5 && (await page.exists('.options-list .expand-button')); level++) {
      if (target && (await page.evaluate(optionIndex(target))) >= 0) break
      const along = path[level] ? await page.evaluate(optionIndex(path[level])) : -1
      await page.evaluate(`(document.querySelectorAll('.options-list .option-item')[${along}]?.querySelector('.expand-button') ?? document.querySelector('.options-list .expand-button')).click()`)
      await page.sleep(300)
      // the list shows a spinner while a level loads
      await page.waitFor(`!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`, 60000)
    }
    const at = target ? await page.evaluate(optionIndex(target)) : 0
    assert.ok(at >= 0 && await page.exists('.options-list .option-checkbox'), `a ${what} can be picked`)
    const label = await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${at}].querySelector('.option-label').innerText.trim()`)
    await page.evaluate(`document.querySelectorAll('.options-list .option-item')[${at}].querySelector('.option-checkbox').click()`)
    await page.sleep(300)
    await page.evaluate(`document.querySelector('.btn-done').click()`)
    await page.sleep(1500)
    return `${what} ${label}`
  }
  const location = await pick(0, 'location', [e.country.name, e.state.name], e.field.name)
  const unit = await pick(1, 'unit')
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 30000)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]'); s.options[0].selected = true; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(2500)
  assert.deepEqual(page.consoleErrors(mark), [], `no console errors after choosing ${location}, ${unit} and a variable`)
})
