// Record group extent and replicate aggregation, on the test database's replicates study (manifest `replicates`,
// breedgraph docs/test-databases.md "The replicates study"): a record group type's optional default extent, each
// study grouping's extent, curation sections by shared groupings with replicates kept together, analyses that must
// combine replicates (the outcomes are the manifest's `expected.cases`), and the levels of a within-unit-graph
// grouping named with their unit graph. Signed in as the writer, who curates the replicates study.
// Needs the analysis worker (see README.md). Creates two draft record group types, which stay, and two groupings of
// the replicates study, which are deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql, uniqueName } from './lib/app.mjs'
import { replicates as r } from './lib/fixture.mjs'
import { RECORD_GROUP_EXTENT_LABELS as labels } from '../../src/composables/ontology/recordGroupExtent.js'

const q = JSON.stringify
const prefix = uniqueName('E2E extent ')
const groupingNamed = (extent, scope) => Object.keys(r.groupings).find((name) => r.groupings[name].extent === extent && r.groupings[name].scope === scope)
const unitNames = Object.fromEntries(Object.entries(r.units).map(([name, id]) => [String(id), name]))

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 2400 }); page = browser.page
  await loginAs(page, 'writer')
})
after(async () => {
  try {
    const study = await graphql(page, 'query ($id: ID!) { programsStudy(id: $id) { result { groupings { id name } } } }', { id: String(r.study.id) })
    for (const g of study.result.groupings.filter((g) => g.name.startsWith(prefix))) {
      await graphql(page, 'mutation ($id: ID!) { programsDeleteGrouping(id: $id) { status } }', { id: g.id })
    }
  } finally {
    await logout(page); await browser?.close()
  }
})

const flatText = (selector) => page.evaluate(`document.querySelector(${q(selector)})?.innerText.replace(/\\s+/g, ' ').trim() ?? null`)

/* ---------- ontology ---------- */

const clickButton = (label) => page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === ${q(label)}).click()`)
const ontologyNode = (name) => `[...document.querySelectorAll('g.node')].find((g) => g.__data__?.name === ${q(name)})`

async function createType(name, defaultExtent) {
  await page.evaluate(`[...document.querySelectorAll('.entry-btn')].find((b) => b.innerText.trim() === 'Record Group Type').click()`)
  await page.waitFor(`document.querySelector('input[name=name]')`)
  await page.type('input[name=name]', name)
  if (defaultExtent) await page.type('select[name=defaultExtent]', defaultExtent)
  await clickButton('Create')
  await page.waitFor(`!document.querySelector('input[name=name]') && ${ontologyNode(name)}`, 30000)
}

// the value of a field of the entry's card, or null when the card doesn't show it
async function cardField(name, label) {
  if ((await flatText('.card-header h2')) !== name) {
    await page.evaluate(`${ontologyNode(name)}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
    await page.waitFor(`document.querySelector('.card-header h2')?.innerText.trim() === ${q(name)}`)
  }
  return page.evaluate(`[...document.querySelectorAll('.card-content .field')].find((f) => f.querySelector('.field-label').textContent.trim() === ${q(label)})?.querySelector('.field-value').textContent.trim() ?? null`)
}

test('ontology: a record group type may suggest a default extent, shown on its card, prefilled and kept on update', async () => {
  const graphType = `${prefix} graph type`
  const plainType = `${prefix} plain type`
  await page.goto(`${config.appUrl}/ontology`)
  await page.waitFor(`document.querySelector('.entry-btn')`, 30000)
  const mark = page.mark()
  await createType(graphType, 'WITHIN_GRAPH')
  await createType(plainType, '')
  assert.equal(await cardField(graphType, 'Default extent'), labels.WITHIN_GRAPH)
  assert.equal(await cardField(plainType, 'Default extent'), null, 'a type without a default extent shows none')

  await cardField(graphType, 'Default extent')
  await page.evaluate(`[...document.querySelectorAll('.card-actions button')].find((b) => b.innerText.includes('Edit')).click()`)
  await page.waitFor(`document.querySelector('select[name=defaultExtent]')`)
  await page.sleep(300)
  assert.equal(await page.evaluate(`document.querySelector('select[name=defaultExtent]').value`), 'WITHIN_GRAPH', 'Edit prefills it')
  await page.type('textarea[name=description]', 'Updated by the record group extent test')
  await clickButton('Update')
  await page.waitFor(`!document.querySelector('select[name=defaultExtent]')`, 30000)
  await page.sleep(1000)
  await page.evaluate(`${ontologyNode(graphType)}.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
  await page.sleep(300)
  assert.equal(await cardField(graphType, 'Default extent'), labels.WITHIN_GRAPH, 'an update keeps it')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

/* ---------- study groupings ---------- */

const programCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(r.program.name)})`
const groupingCard = (name) => `[...${programCard}.querySelectorAll('.grouping-card')].find((c) => c.querySelector('h4').innerText.trim() === ${q(name)})`
const extentBadge = (name) => page.evaluate(`${groupingCard(name)}?.querySelector('.extent-badge')?.innerText.trim() ?? null`)
const checkedExtent = () => page.evaluate(`[...document.querySelectorAll('.grouping-form input[type=radio]')].find((i) => ${q(Object.keys(labels))}.includes(i.value) && i.checked)?.value ?? null`)

async function openGroupings() {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`${programCard}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.trials-header').click()`)
  await page.waitFor(`${programCard}.querySelector('.trial-card .studies-header')`, 30000)
  await page.evaluate(`${programCard}.querySelector('.studies-header').click()`)
  await page.waitFor(`${programCard}.querySelector('.study-card .section-toggle')`, 30000)
  await page.evaluate(`[...${programCard}.querySelectorAll('.study-card .section-toggle')].find((b) => b.innerText.includes('Record Groupings')).click()`)
  await page.waitFor(`${programCard}.querySelector('.record-grouping-panel .grouping-card')`, 30000)
  await page.waitFor(`!${programCard}.querySelector('.controller-badge[disabled]')`, 30000)
  await page.sleep(500)
}

async function openGroupingForm(edit = null) {
  if (edit) await page.evaluate(`${groupingCard(edit)}.querySelector('.card-actions button[title=Edit]').click()`)
  else await page.evaluate(`[...${programCard}.querySelectorAll('.record-grouping-panel button')].find((b) => b.innerText.includes('Create Grouping')).click()`)
  await page.waitFor(`document.querySelector('.grouping-form')`)
  await page.sleep(300)
}

async function saveGrouping(name) {
  await page.click('.grouping-form button[type=submit]')
  await page.waitFor(`!document.querySelector('.grouping-form') && ${groupingCard(name)}`, 30000)
  await page.sleep(300)
}

test('groupings: the replicates study shows the extent of each of its groupings', async () => {
  await openGroupings()
  for (const [name, g] of Object.entries(r.groupings)) {
    assert.equal(await extentBadge(name), labels[g.extent], `${name} is ${g.extent}`)
  }
})

test('groupings: a new grouping asks for its extent, prefilled from its type\'s default, and an edit can change it', async () => {
  const types = (await graphql(page, 'query { ontologyEntries(labels: [RECORD_GROUP_TYPE], view: PUBLISHED) { result { ... on RecordGroupType { id name defaultExtent } } } }')).result
  const withDefault = types.find((t) => t.defaultExtent === 'WITHIN_GRAPH') ?? types.find((t) => t.defaultExtent)
  const withoutDefault = types.find((t) => !t.defaultExtent)
  assert.ok(withDefault && withoutDefault, `published types with and without a default extent: ${q(types)}`)
  const plain = `${prefix} plain grouping`
  const prefilled = `${prefix} prefilled grouping`
  const mark = page.mark()
  await openGroupings()

  // a type without a default: nothing is chosen, and the form asks for it
  await openGroupingForm()
  await page.type('.grouping-form #name', plain)
  await page.type('.grouping-form #typeId', withoutDefault.id)
  assert.equal(await checkedExtent(), null, `${withoutDefault.name} suggests no extent`)
  await page.click('.grouping-form button[type=submit]')
  await page.sleep(300)
  assert.match(await flatText('.grouping-form'), /Extent is required/, 'the extent is required')
  await page.check('.grouping-form input[type=radio][value=SHARED]')
  // a choice is not replaced by the default of a type picked afterwards
  await page.type('.grouping-form #typeId', withDefault.id)
  await page.sleep(200)
  assert.equal(await checkedExtent(), 'SHARED', 'the chosen extent stays when the type changes')
  await page.type('.grouping-form #typeId', withoutDefault.id)
  await saveGrouping(plain)
  assert.equal(await extentBadge(plain), labels.SHARED)

  // a type with a default: it is prefilled, and marked as the type's default
  await openGroupingForm()
  await page.type('.grouping-form #name', prefilled)
  await page.type('.grouping-form #typeId', withDefault.id)
  await page.sleep(200)
  assert.equal(await checkedExtent(), withDefault.defaultExtent, `${withDefault.name} prefills its default`)
  const marked = await page.evaluate(`[...document.querySelectorAll('.grouping-form .radio-label')].find((l) => l.innerText.includes("(the type's default)"))?.querySelector('input').value ?? null`)
  assert.equal(marked, withDefault.defaultExtent, 'the default is marked')
  await saveGrouping(prefilled)
  assert.equal(await extentBadge(prefilled), labels[withDefault.defaultExtent])

  // editing: the saved extent is prefilled, and changing it says what that changes
  await openGroupingForm(plain)
  assert.equal(await checkedExtent(), 'SHARED', 'Edit prefills the extent')
  assert.equal(await page.exists('.grouping-form .extent-info'), false, 'no note while it is unchanged')
  await page.check('.grouping-form input[type=radio][value=WITHIN_UNIT]')
  await page.sleep(200)
  assert.match(await flatText('.grouping-form'), /Changing from shared changes how analysis groups the codes/)
  await saveGrouping(plain)
  assert.equal(await extentBadge(plain), labels.WITHIN_UNIT, 'the update changes it')

  // deleting (the harness confirms)
  for (const name of [plain, prefilled]) {
    await page.evaluate(`${groupingCard(name)}.querySelector('.card-actions button.delete').click()`)
    await page.waitFor(`!${groupingCard(name)}`, 30000)
  }
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

/* ---------- curation ---------- */

const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const option = (label) => `[...document.querySelectorAll('.options-list .option-label')].find((e) => e.innerText.trim().startsWith(${q(label)})).closest('.option-item')`

// pick the replicates study in an open study picker, by walking program and trial
async function pickStudy() {
  await page.waitFor(levelLoaded, 30000)
  for (const name of [r.program.name, r.trial.name]) {
    await page.evaluate(`${option(name)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  assert.ok((await optionLabels()).some((l) => l.startsWith(r.study.name)), 'the replicates study is listed')
  await page.evaluate(`${option(r.study.name)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
}

// open the curation table of the replicates study for some variables (and factors), narrowed to the records of one day
async function loadCuration(concepts, day, factors = []) {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await pickStudy()
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 60000)
  for (const [name, wanted] of [['variableIds', concepts], ['factorIds', factors]]) {
    if (!wanted.length) continue
    await page.evaluate(`(() => { const s = document.querySelector('select[name=${name}]'); for (const o of s.options) o.selected = ${q(wanted)}.includes(o.innerText.trim()); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  }
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  if (day) {
    await page.type('.record-filters input[name=start]', day)
    await page.type('.record-filters input[name=end]', day)
  }
  await page.evaluate(`[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table')).click()`)
  await page.waitFor(`document.querySelector('.table-wrapper tbody tr:not(.spacer-row):not(.section-header)')`, 60000)
  await page.sleep(1000)
}

const datasetStart = async (key) => {
  const summaries = (await graphql(page, 'query ($id: ID!) { datasetsSummaries(studyId: $id) { result { id start end } } }', { id: String(r.study.id) })).result
  return { summaries, start: summaries.find((s) => String(s.id) === String(r.datasets[key].id)).start }
}

test('curation: same_time and width are sectioned by the shared dataset-scoped grouping, with each tree\'s replicates together', async () => {
  const replicate = groupingNamed('WITHIN_UNIT', 'DATASET_SCOPED')
  const plate = groupingNamed('SHARED', 'DATASET_SCOPED')
  const block = groupingNamed('WITHIN_GRAPH', 'STUDY_WIDE')
  const sameTime = r.datasets.same_time
  const { summaries, start } = await datasetStart('same_time')
  assert.equal(start, summaries.find((s) => String(s.id) === String(r.datasets.width.id)).start, 'same_time and width share their start')
  assert.equal(summaries.filter((s) => s.start === start).length, 2, `only same_time and width start at ${start}`)

  const mark = page.mark()
  await loadCuration([r.concepts.height.name, r.concepts.width.name], start)

  // the grouping columns: the replicate one is within unit, the study's blocks within the unit graph
  const headers = await page.evaluate(`[...document.querySelectorAll('.table-wrapper thead th')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  const header = (name) => headers.find((h) => h.startsWith(name))
  assert.match(header(replicate), /\bWU\b/, `the WU badge on ${replicate}`)
  assert.match(header(block), /\bWG\b/, `the WG badge on ${block}`)
  assert.doesNotMatch(header(plate), /\b(WU|WG)\b/, `no extent badge on ${plate}`)

  const rows = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)')].map((tr) =>
    tr.classList.contains('section-header') ? { section: tr.innerText.replace(/\\s+/g, ' ').trim() } : { cells: [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()) })`)
  // sections by the plate codes only, never by a replicate code
  const sections = rows.filter((row) => row.section).map((row) => row.section)
  const plateCodes = r.expected.levels.same_time[plate].map((key) => key.split('|').at(-1))
  assert.equal(sections.length, plateCodes.length, `a section per plate: ${sections.join('; ')}`)
  for (const code of plateCodes) assert.ok(sections.some((s) => s.includes(`${plate}: ${code}`)), `a section for ${plate} ${code}: ${sections.join('; ')}`)
  assert.ok(sections.every((s) => !s.includes(replicate)), 'no section by the replicate codes')
  const uncoded = groupingNamed('WITHIN_GRAPH', 'DATASET_SCOPED')
  assert.ok(sections.every((s) => !s.includes(uncoded)), `${uncoded}, with no codes in these rows, is left out: ${sections.join('; ')}`)
  const sectionRows = sections.reduce((sum, s) => sum + Number(s.match(/\((\d+) rows?\)/)[1]), 0)
  assert.equal(sectionRows, sameTime.record_count, 'height and width share a row for each reading of same_time')

  // within a section, each tree's rows are together, its replicates in code order
  const unitColumn = headers.indexOf('Unit ID')
  const codeColumn = headers.indexOf(header(replicate))
  const data = rows.filter((row) => row.cells)
  assert.equal(data.length, sameTime.record_count, 'every row is loaded')
  const runs = []
  for (const { cells } of data) {
    const unit = cells[unitColumn]
    if (runs.at(-1)?.unit !== unit) runs.push({ unit, codes: [] })
    runs.at(-1).codes.push(Number(cells[codeColumn]))
  }
  const units = runs.map((run) => run.unit)
  assert.equal(new Set(units).size, units.length, `each tree's rows are adjacent: ${units.join(', ')}`)
  for (const run of runs) assert.deepEqual(run.codes, [...run.codes].sort((a, b) => a - b), `the replicates of ${run.unit} are in code order`)
  for (const id of sameTime.units_with_replicates) {
    assert.ok(runs.find((run) => run.unit === String(id))?.codes.length > 1, `unit ${id} has its replicates as rows`)
  }
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('curation: records with a time of day show it as given and have nothing to save', async () => {
  const { start } = await datasetStart('windowed')
  const day = start.slice(0, 10)
  const mark = page.mark()
  await loadCuration([r.concepts.height.name], day)
  const starts = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row):not(.section-header)')].map((tr) => tr.querySelectorAll('td')[2]?.innerText.trim())`)
  assert.equal(starts.length, r.datasets.windowed.record_count, 'the records of windowed')
  assert.ok(starts.every((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)), `times of day as the API gives them: ${starts.slice(0, 3).join(', ')}`)
  const save = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Save Changes')); return b && b.disabled })()`)
  assert.equal(save, true, 'Save Changes is disabled until something changes')

  // the unit's location, from its field when the tree itself has no position
  await page.click('.column-toggles summary')
  await page.evaluate(`[...document.querySelectorAll('.column-menu label')].find((l) => l.innerText.trim() === 'Location').querySelector('input').click()`)
  await page.sleep(500)
  const headers = await page.evaluate(`[...document.querySelectorAll('.table-wrapper thead th')].map((e) => e.innerText.trim())`)
  const locations = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row):not(.section-header)')].map((tr) => tr.querySelectorAll('td')[${headers.indexOf('Location')}]?.innerText.trim())`)
  assert.ok(headers.includes('Location') && locations.every(Boolean), `every tree has its field's location: ${q(locations.slice(0, 3))}`)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('curation: factor records come first, apart from the variable records, for all times and levels', async () => {
  const mark = page.mark()
  await loadCuration([r.concepts.height.name], null, [r.datasets.factor.concept_name])
  const rows = await page.evaluate(`[...document.querySelectorAll('.table-wrapper tbody tr:not(.spacer-row)')].map((tr) =>
    tr.classList.contains('section-header') ? { section: tr.innerText.trim() } : { cells: [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()) })`)
  assert.equal(rows[0].section, `Factor records (${r.datasets.factor.record_count} rows)`, 'the factor records are the first section')
  const factorRows = rows.slice(1, 1 + r.datasets.factor.record_count)
  assert.ok(factorRows.every((row) => row.cells && row.cells[2] === 'all times' && row.cells[3] === 'all times'), `undated factor records apply at all times: ${q(factorRows.slice(0, 2))}`)
  assert.ok(rows[1 + r.datasets.factor.record_count].section, 'the variable records follow in their own section')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

/* ---------- analysis ---------- */

const viewStatus = `document.querySelector('.submission-view .title-row .status-badge:not(.running)')`
const term = (i) => `document.querySelectorAll('#analysis-terms .term')[${i}]`
const termField = (i, label) => `[...${term(i)}.querySelectorAll('.field')].find((f) => f.querySelector('label')?.innerText.trim() === ${q(label)})`

async function openEditor() {
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await pickStudy()
  await page.waitFor(`document.querySelector('#analysis-data .dataset-row input')`, 60000)
}

async function selectDataset(key) {
  const { id, concept_name: concept } = r.datasets[key]
  await page.click(`#analysis-data .dataset-row input[value="${id}"]`)
  await page.waitFor(`[...document.querySelectorAll('#analysis-terms .add-terms select option')].some((o) => o.text.startsWith(${q(concept)}))`, 60000)
}

async function addConcept(name) {
  await page.evaluate(`(() => { const s = document.querySelector('#analysis-terms .add-terms select'); s.value = [...s.options].find((o) => o.text.startsWith(${q(name)})).value; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(200)
  await page.evaluate(`[...document.querySelectorAll('#analysis-terms .add-terms button')].find((b) => b.innerText.trim() === 'Add').click()`)
  await page.sleep(300)
}

// choose an option once it is offered: a reopened editor offers a concept's options only once its datasets have loaded
async function setSelect(element, value) {
  await page.waitFor(`[...${element}.options].some((o) => o.value === ${q(value)})`, 30000)
  await page.evaluate(`(() => { const s = ${element}; s.value = ${q(value)}; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
}

async function submit() {
  await page.evaluate(`[...document.querySelectorAll('.submit-actions button')].find((b) => b.innerText.includes('Submit')).click()`)
  await page.waitFor(viewStatus, 180000)
  await page.sleep(500)
}

// the messages of the shown analysis: { code, severity, items: [text] }
const messages = () => page.evaluate(`[...document.querySelectorAll('.submission-view .analysis-messages .message')].map((m) => ({
  code: m.querySelector('.message-header strong').innerText.trim(),
  severity: ['error', 'warning', 'info'].find((s) => m.classList.contains(s)) ?? null,
  items: [...m.querySelectorAll('li')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim())
}))`)
const statusLabel = () => page.evaluate(`${viewStatus}.innerText.replace(/[^A-Za-z ]/g, '').trim()`)

const describeCase = (c) => [
  `aggregation ${c.aggregation.toLowerCase()}`,
  c.replicate_aggregation ? `replicates ${c.replicate_aggregation.aggregation.toLowerCase()}${c.replicate_aggregation.window ? ` within ${c.replicate_aggregation.window}` : ''}` : 'replicates not combined'
].join(', ')

for (const c of r.expected.cases) {
  const outcome = c.error ? `${c.error.code} at ${c.error.path_end}` : `completes${c.warnings.length ? ` with ${c.warnings.join(', ')}` : ''}`
  test(`analysis: descriptive statistics of ${c.dataset}, ${describeCase(c)}: ${outcome}`, async () => {
    await openEditor()
    await selectDataset(c.dataset)
    await addConcept(r.datasets[c.dataset].concept_name)
    await page.click('#analysis-terms .term .expand')
    await page.waitFor(`${term(0)}.querySelector('.term-body')`)
    if (c.aggregation !== 'NONE') await setSelect(`${termField(0, 'Aggregation')}.querySelector('select')`, c.aggregation)
    if (c.replicate_aggregation) {
      const replicates = `document.getElementById('terms.0.replicateAggregation')`
      await page.waitFor(replicates)
      await setSelect(`${replicates}.querySelector('select')`, c.replicate_aggregation.aggregation)
      await page.sleep(200)
      if (c.replicate_aggregation.window) await setSelect(`${replicates}.querySelector('.window-select')`, c.replicate_aggregation.window)
    }
    await submit()
    const shown = await messages()
    if (c.error) {
      assert.equal(await statusLabel(), 'Failed', q(shown))
      const error = shown.find((m) => m.code === c.error.code && m.severity === 'error')
      assert.ok(error, `${c.error.code} is shown: ${q(shown)}`)
      assert.ok(error.items.some((item) => item.endsWith(`› ${c.error.path_end}`) && item.includes(`${c.error.record_count} records`)),
        `at ${c.error.path_end}, for ${c.error.record_count} records: ${q(error.items)}`)
    } else {
      assert.equal(await statusLabel(), 'Completed', q(shown))
      assert.deepEqual(shown.filter((m) => m.severity === 'warning').map((m) => m.code).sort(), [...c.warnings].sort(), q(shown))
    }
  })
}

test('analysis: a failed analysis reopens at its replicates, and combining them there completes', async () => {
  await openEditor()
  await selectDataset('same_time')
  await addConcept(r.datasets.same_time.concept_name)
  await submit()
  assert.equal(await statusLabel(), 'Failed')
  await page.clickText('Edit & resubmit')
  await page.waitFor(`document.querySelector('.config-editor')`)
  const replicates = `document.getElementById('terms.0.replicateAggregation')`
  await page.waitFor(replicates, 30000)
  assert.match(await page.evaluate(`${replicates}.innerText`), /Set a replicate aggregation on the term/, 'the message is shown at the replicates field')
  await setSelect(`${replicates}.querySelector('select')`, 'MEAN')
  await submit()
  assert.equal(await statusLabel(), 'Completed', q(await messages()))
})

test('analysis: the levels of a within-unit-graph grouping are named with their unit graph, and a shared level merges them', async () => {
  const block = groupingNamed('WITHIN_GRAPH', 'STUDY_WIDE')
  const levelsOf = () => page.evaluate(`[...document.querySelectorAll('.submission-view table tbody tr')].map((tr) => tr.querySelector('td, th')?.innerText.trim()).filter((l) => l && l !== 'All observations')`)
  await openEditor()
  await selectDataset('blocks')
  await page.clickText('Add record group dimension')
  await page.sleep(300)
  const groupingOption = `[...document.querySelectorAll('#analysis-grouping .grouping-option')].find((l) => l.innerText.trim().startsWith(${q(block)}))`
  assert.equal(await page.evaluate(`${groupingOption}.querySelector('.extent-badge').innerText.trim()`), labels.WITHIN_GRAPH.toLowerCase())
  await page.evaluate(`${groupingOption}.querySelector('input').click()`)
  await page.sleep(300)
  await page.evaluate(`[...document.querySelectorAll('#analysis-terms .chip')].find((c) => c.innerText.includes('Record group 1')).click()`)
  await addConcept(r.concepts.height.name)
  await submit()
  assert.equal(await statusLabel(), 'Completed', q(await messages()))
  const expected = r.expected.levels.blocks[block].map((key) => {
    const [, , root, code] = key.split('|')
    return `${block}: ${code} of ${unitNames[root]}`
  })
  assert.equal(expected.length, r.expected.blocks.block_levels)
  assert.deepEqual((await levelsOf()).sort(), expected.sort(), 'a level for each block of each field, named with its field')

  // a shared level of "Block 1" merges it across the fields
  const code = r.expected.levels.blocks[block][0].split('|').at(-1)
  await page.clickText('Edit & resubmit')
  await page.waitFor(`document.querySelector('.config-editor')`)
  await page.sleep(500)
  await page.clickText('+ Add shared level')
  await page.sleep(200)
  await page.type('#analysis-grouping .level-header input', code)
  await page.clickText('+ Add code')
  await page.sleep(200)
  const member = `document.querySelector('#analysis-grouping .member-select')`
  await setSelect(`${member}.querySelector('select')`, String(r.groupings[block].id))
  await page.sleep(300)
  await page.evaluate(`(() => { const s = ${member}.querySelectorAll('select')[1]; s.value = [...s.options].find((o) => o.text.trim().startsWith(${q(code)})).value; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await submit()
  assert.equal(await statusLabel(), 'Completed', q(await messages()))
  const levels = await levelsOf()
  assert.equal(levels.length, r.expected.blocks.block_levels_with_block_1_shared, `the shared level replaces the ${code} of each field: ${levels.join('; ')}`)
  assert.ok(levels.some((l) => l.endsWith(code) && !l.includes(' of ')), `a level for the shared ${code}: ${levels.join('; ')}`)
})
