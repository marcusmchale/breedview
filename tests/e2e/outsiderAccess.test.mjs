// What a registered user outside every team (the test database's outsider) sees on the pages: what is released to
// registered users or the public, hidden members skipped, placeholders where a hidden entity holds readable ones,
// stand-ins for hidden teams, and no write actions. What the API returns for each viewer is tested in breedgraph
// (tests/breedgraph/e2e/*_read_api.py); here, that the pages show it. The trees are drawn in breedgraph's
// tests/breedgraph/scenarios/read_policy_scenario.py.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, flat } from './lib/app.mjs'
import { entities as e, teams, concept, replicates, arrivals } from './lib/fixture.mjs'

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await loginAs(page, 'outsider')
})
after(async () => { await logout(page); await browser?.close() })

const pageText = async () => flat(await page.text('main') ?? await page.text('body'))
// click every unexpanded expand button matching selector, level by level
const expandAll = async (selector) => {
  for (let level = 0; level < 8; level++) {
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(selector)})]; b.forEach((e) => e.click()); return b.length })()`)
    if (!clicked) return
    await page.sleep(2000)
  }
}
// the buttons of the page that create, change or remove something
const writeActions = () => page.evaluate(`[...document.querySelectorAll('main button')].map((e) => e.innerText.trim())
  .filter((t) => /(Create|Edit|Delete|Add|New|Register|Position)/.test(t))`)
const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const openOption = async (label) => {
  await page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].find((e) => e.innerText.trim().startsWith(${JSON.stringify(label)}))
    .closest('.option-item').querySelector('.expand-button').click()`)
  await page.sleep(300)
  await page.waitFor(levelLoaded, 60000)
}
// the controller badge of the program, trial or study card with this name
const badgeOf = (card, name) => `[...document.querySelectorAll('.controller-badge')].find((b) => b.closest(${JSON.stringify(card)})
  ?.querySelector('h3, h4, strong')?.innerText.trim() === ${JSON.stringify(name)})`
const organisation = teams.root.name

async function openPrograms() {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.body.innerText.includes('REDACTED')`, 30000)
  // expand until both readable studies show: a level can still be loading when the next is clicked in a full run
  const studiesShown = `[${JSON.stringify(e.study_public.name)}, ${JSON.stringify(e.study_registered.name)}].every((n) => document.body.innerText.includes(n))`
  for (let round = 0; round < 6 && !(await page.evaluate(studiesShown)); round++) {
    await page.evaluate(`[...document.querySelectorAll('.expand-icon')].filter((e) => e.innerText.includes('►')).forEach((e) => e.parentElement.click())`)
    await page.sleep(2500)
  }
  await page.waitFor(studiesShown, 30000)
  await page.waitFor(`!document.querySelector('.controller-badge[disabled]')`, 30000)
}

test('programs: the readable studies, below placeholders for the hidden trial and program holding one', async () => {
  await openPrograms()
  const text = await pageText()
  assert.equal(text.match(/REDACTED/g)?.length, 2, `the program and the trial are placeholders: ${text}`)
  for (const name of ['program_public', 'trial_public', 'study_public', 'study_registered']) {
    assert.ok(text.includes(e[name].name), `${name} is shown`)
  }
  for (const name of ['program', 'trial', 'study_private']) assert.ok(!text.includes(e[name].name), `${name} is not shown`)
  assert.ok(page.consoleErrors().length === 0, `no console errors: ${page.consoleErrors()}`)
})

test('programs: no write actions are offered to a user without a team', async () => {
  assert.deepEqual(await writeActions(), [], 'create, edit and delete are hidden')
})

test('controllers: a hidden controlling team is shown as the nearest team the user can see, marked as such', async () => {
  await page.evaluate(`${badgeOf('.study-card', e.study_public.name)}.click()`)
  await page.waitFor(`document.body.innerText.includes("Teams you can't see")`, 30000)
  const modal = await pageText()
  assert.ok(modal.includes(`A team in ${organisation}`), 'the stand-in is named as such')
  assert.ok(modal.includes('Request an affiliation'), 'with a way to ask for access')
  await page.evaluate(`document.querySelector('.modal-close').click()`)
})

test('controllers: a hidden program has a placeholder controller, whom to ask without its history', async () => {
  await page.evaluate(`${badgeOf('.program-card-header', 'REDACTED')}.click()`)
  await page.waitFor(`document.querySelector('.history-hidden-note')`, 30000)
  const modal = await pageText()
  assert.ok(!/Created:|Write History/.test(modal), 'no history')
  assert.ok(modal.includes(`A team in ${organisation}`), 'whom to ask')
  await page.evaluate(`document.querySelector('.modal-close').click()`)
})

test('locations: readable locations joined past hidden ones, a hidden root as a placeholder', async () => {
  await page.goto(`${config.appUrl}/locations`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  await expandAll('.location-header .expand-btn:not(.expanded)')
  const childrenOf = (name) => page.evaluate(`[...[...document.querySelectorAll('.location-node')].find((e) => e.querySelector('.location-name').innerText.trim() === ${JSON.stringify(name)})
    ?.querySelector(':scope > .children')?.querySelectorAll(':scope > .child-item > .location-node') ?? []].map((n) => n.querySelector('.location-name').innerText.trim()).sort()`)
  // the private state is skipped, as is the other organisation's private centre between the field and the lab
  assert.deepEqual(await childrenOf(e.country.name), [e.field.name, e.field_registered.name].sort())
  assert.deepEqual(await childrenOf(e.field.name), [e.lab.name])
  assert.deepEqual(await childrenOf('REDACTED'), [e.state_public.name], 'the hidden region root holds the public state')
  const text = await pageText()
  for (const name of ['state', 'centre', 'country_private']) assert.ok(!text.includes(e[name].name), `${name} is not shown`)
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(e.field.name)}).click()`)
  await page.waitFor(`document.querySelector('.details-card h2')?.innerText.trim() === ${JSON.stringify(e.field.name)}`, 30000)
  await page.sleep(1000)
  assert.deepEqual(await writeActions(), [], 'no location actions')
  assert.ok(!(await page.evaluate(`!!document.querySelector('.leaflet-pm-toolbar')?.offsetParent`)), 'no drawing tools on the map')
})

test('units: the readable trees under a placeholder for their hidden unit graph root, hidden units between skipped', async () => {
  await page.goto(`${config.appUrl}/units`)
  await page.waitFor(`document.querySelector('.location-header .expand-btn')`, 30000)
  await expandAll('.location-header .expand-btn:not(.expanded)')
  await page.evaluate(`[...document.querySelectorAll('.location-name')].find((e) => e.innerText.trim() === ${JSON.stringify(e.field.name)}).click()`)
  await page.waitFor(`document.querySelector('.block-item')`, 30000)
  // the private plot at the field holds nothing readable, so it is left out
  const blocks = await page.evaluate(`[...document.querySelectorAll('.block-item .block-name')].map((e) => e.innerText.trim())`)
  assert.deepEqual(blocks, ['REDACTED'], 'the hidden field unit is the only block')
  await page.click('.block-item')
  await page.waitFor(`document.querySelector('.tree-node .expand-btn')`, 30000)
  await expandAll('.tree-node .expand-btn:not(.expanded)')
  const nodes = await page.evaluate(`[...document.querySelectorAll('.tree-node .node-name')].map((e) => e.innerText.trim())`)
  // the private leaves are skipped: the rhizospheres hang from the public tree
  assert.deepEqual(nodes.slice(1).sort(), ['tree_public', 'tree_registered', 'rhizosphere_public', 'rhizosphere_other'].map((n) => e[n].name).sort(), `${nodes}`)
  assert.equal(nodes[0], 'REDACTED')
  const germplasm = await page.evaluate(`[...document.querySelectorAll('.tree-node .node-header')].map((h) => [h.querySelector('.node-name').innerText.trim(), h.querySelector('.germplasm-badge')?.innerText.trim()])`)
  assert.deepEqual(Object.fromEntries(germplasm)[e.tree_registered.name], 'REDACTED', 'a tree of hidden germplasm shows it as a placeholder')
  assert.deepEqual(Object.fromEntries(germplasm)[e.tree_public.name], e.crop_leaf.name)
  await page.evaluate(`[...document.querySelectorAll('.tree-node .node-header')].find((h) => h.querySelector('.node-name').innerText.trim() === ${JSON.stringify(e.tree_public.name)}).click()`)
  await page.waitFor(`document.querySelector('.location-units-panel .details-card h2')?.innerText.trim() === ${JSON.stringify(e.tree_public.name)}`, 30000)
  await page.sleep(1000)
  assert.deepEqual(await writeActions(), [], 'no unit or position actions')
})

test('curation: the readable dataset with all its records, hidden units as placeholders', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  // the replicates and arrivals programs are released to every registered account
  const released = [replicates.program.name, ...(arrivals ? [arrivals.program.name] : [])]
  assert.deepEqual((await optionLabels()).sort(), ['REDACTED', e.program_public.name, ...released].sort(),
    'the hidden program is a placeholder')
  await openOption('REDACTED')
  assert.deepEqual(await optionLabels(), ['REDACTED'], 'and so is its trial')
  await openOption('REDACTED')
  assert.deepEqual(await optionLabels(), [e.study_public.name], 'the private study is left out')
  await page.evaluate(`document.querySelector('.options-list .option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=variableIds] option') || document.querySelector('.no-concepts-msg')`, 60000)
  const concepts = await page.evaluate(`[...document.querySelectorAll('select[name=variableIds] option')].map((o) => o.innerText.trim())`)
  assert.deepEqual(concepts, [concept], `the readable dataset's concept is offered: ${flat(await page.text('.no-concepts-msg'))}`)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]'); s.options[0].selected = true; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  const hint = flat(await page.text('.datasets-hint'))
  assert.match(hint, /\b1 dataset\b/, `one dataset, the private one of the study left out: ${hint}`)

  // the recorded units under their nearest readable ancestor: the hidden block root is not kept for them
  await page.evaluate(`document.querySelector('.record-filters .hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 60000)
  const roots = await optionLabels()
  assert.deepEqual(roots.map((r) => r.split(' ')[0]).sort(), [e.tree_public.name, e.tree_registered.name].sort(), `the trees are the roots: ${roots}`)
  await openOption(e.tree_public.name)
  const children = await optionLabels()
  assert.deepEqual(children.map((c) => c.split(' ')[0]).sort(), [e.rhizosphere_public.name, 'REDACTED'].sort(),
    `the private leaf as a placeholder, the public rhizosphere below it joined to the tree: ${children}`)
  await page.click('.btn-done')
  await page.sleep(300)

  await page.evaluate(`[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table')).click()`)
  await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row)')`, 60000)
  const rows = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  for (const name of ['tree_public', 'tree_registered', 'rhizosphere_public']) {
    assert.ok(rows.some((r) => r.includes(e[name].name)), `a row for ${name}: ${rows}`)
  }
  assert.ok(rows.some((r) => r.includes('REDACTED')), 'a row for the private leaf, as a placeholder')
})
