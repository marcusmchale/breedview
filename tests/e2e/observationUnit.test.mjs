// The observation unit by subject (breedgraph docs/analysis.md §3): each record's unit rolled up into its nearest unit
// of a chosen subject. On the test database's replicates study (manifest `replicates`), as the writer: the tree heights
// observed at the plot subject give each plot's mean as the manifest's `plot_means` has it, and the analysis page names
// the observation unit. The editor shows the observation unit first, then the dimensions in their order, and loads the
// subjects chosen. Needs the analysis worker (see README.md). The analysis is deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { manifest, replicates as r } from './lib/fixture.mjs'

const q = JSON.stringify
const PLOT = String(manifest.ids.ontology_subject_plot)
const HEIGHT = { type: 'CONCEPT', conceptId: String(r.concepts.height.id) }

let browser, page, analysisId
before(async () => {
  browser = await launchBrowser({ height: 2400 }); page = browser.page
  await loginAs(page, 'writer')
  const submitted = await graphql(page, 'mutation ($a: AnalysisInput!) { analysisSubmit(analysis: $a) { status result errors { message } } }', { a: {
    analysisType: 'DESCRIPTIVE_STATISTICS', name: 'E2E observation unit', datasetIds: [String(r.datasets.same_time.id)],
    descriptiveStatistics: {
      terms: [{ reference: HEIGHT, aggregation: 'MEAN' }, { reference: { type: 'UNIT' } }],
      grouping: { unit: { subjectIds: [PLOT] } }
    }
  } })
  assert.equal(submitted.status, 'SUCCESS', q(submitted.errors))
  analysisId = String(submitted.result)
  for (let i = 0; i < 120; i++) {
    const s = (await graphql(page, 'query ($id: ID!) { analysisSubmission(id: $id) { result { status errors { message } } } }', { id: analysisId })).result
    if (s.status === 'COMPLETED' || s.status === 'FAILED') {
      assert.equal(s.status, 'COMPLETED', q(s.errors))
      return
    }
    await page.sleep(1000)
  }
  assert.fail('the analysis did not finish; is the analysis worker running?')
})
after(async () => {
  try {
    if (analysisId) await graphql(page, 'mutation ($id: ID!) { analysisDelete(id: $id) { status } }', { id: analysisId })
    await logout(page)
  } finally {
    await browser?.close()
  }
})

test('observed at the plot subject, the trees of each plot are one observation of the plot', async () => {
  const result = (await graphql(page, `query ($id: ID!) { analysisSubmission(id: $id) { result { result {
    ... on DescriptiveStatisticsResult { terms { levels { level } mean } } } } } }`, { id: analysisId })).result.result
  const byPlot = Object.fromEntries(result.terms.filter((t) => t.levels.length).map((t) => [t.levels[0].level, t.mean]))
  const expected = Object.fromEntries(Object.values(r.expected.plot_means).map((p) => [String(p.unit_id), p.pooled]))
  assert.deepEqual(byPlot, expected)

  await page.goto(`${config.appUrl}/analysis?id=${analysisId}`)
  const summary = `document.querySelector('.submission-view .config-summary')`
  await page.waitFor(`${summary}?.innerText.includes('Observation unit')`, 60000)
  assert.match(await page.evaluate(`${summary}.innerText`), /Observation unit Nearest unit of \S/)
})

test('the editor shows the observation unit first, then the dimensions, and loads the subjects chosen', async () => {
  await page.goto(`${config.appUrl}/analysis?id=${analysisId}`)
  const edit = `[...document.querySelectorAll('.submission-view .header-actions button')].find((b) => b.innerText.includes('Edit'))`
  await page.waitFor(`${edit} && !${edit}.disabled`, 60000)
  await page.evaluate(`${edit}.click()`)
  const section = `document.querySelector('#analysis-grouping')`
  await page.waitFor(`${section}?.querySelector('.observation-unit .subject-chips .chip.selected')`, 30000)

  const titles = await page.evaluate(`[...${section}.querySelectorAll('.subsection-title')].map((h) => h.innerText.trim())`)
  assert.deepEqual(titles, ['Observation unit', 'Dimensions', 'Record group dimensions'])
  const dimensions = await page.evaluate(`[...${section}.querySelectorAll('.box:not(.observation-unit) .box-header h4')].map((h) => h.innerText.trim())`)
  assert.deepEqual(dimensions, ['Germplasm', 'Position', 'Time'])

  // the analysis's subject is chosen; each record's unit takes it away, and choosing subjects again starts with none,
  // which the editor asks for before submitting
  const radios = `[...${section}.querySelectorAll('.observation-unit input[type=radio]')]`
  assert.deepEqual(await page.evaluate(`${radios}.map((r) => r.checked)`), [false, true])
  assert.equal(await page.evaluate(`${section}.querySelectorAll('.observation-unit .chip.selected').length`), 1)
  await page.evaluate(`${radios}[0].click()`)
  await page.waitFor(`!${section}.querySelector('.observation-unit .subject-chips')`, 10000)
  await page.evaluate(`${radios}[1].click()`)
  await page.waitFor(`${section}.querySelector('.observation-unit .subject-chips')`, 10000)
  assert.equal(await page.evaluate(`${section}.querySelectorAll('.observation-unit .chip.selected').length`), 0)
  await page.waitFor(`[...document.querySelectorAll('.submit-bar .problems li')].some((li) => li.innerText.includes('subjects of the observation unit'))`, 10000)
})
