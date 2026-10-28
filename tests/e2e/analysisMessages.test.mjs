// An analysis's errors and warnings on the fields of the editor, when it is edited and resubmitted: each message stays
// on the term, dataset or exclusion rule it is about when another is removed before it, and goes with its own. The
// messages and the fields they link to name concepts and datasets, and number rules as the editor does. On the
// test database's replicates study (manifest `replicates`), as the writer: tree heights and canopy widths averaged
// with their replicates pooled (a REPLICATES_POOLED warning on each term), the light factor's dataset with no term
// (UNUSED_DATASET) and two exclusion rules, the first matching nothing (EXCLUDED_BY_CONFIG on each). Needs the
// analysis worker (see README.md). The analysis is deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { replicates as r } from './lib/fixture.mjs'

const q = JSON.stringify
const HEIGHT = r.datasets.same_time
const WIDTH = r.datasets.width
const LIGHT = r.datasets.factor

const analysisIds = []
// a descriptive analysis submitted, once it completes: its ID and warnings
async function analyse (name, analysis) {
  const submitted = await graphql(page, 'mutation ($a: AnalysisInput!) { analysisSubmit(analysis: $a) { status result errors { message } } }', {
    a: { analysisType: 'DESCRIPTIVE_STATISTICS', name, ...analysis }
  })
  assert.equal(submitted.status, 'SUCCESS', q(submitted.errors))
  const id = String(submitted.result)
  analysisIds.push(id)
  for (let i = 0; i < 120; i++) {
    const s = (await graphql(page, 'query ($id: ID!) { analysisSubmission(id: $id) { result { status warnings { code message path } } } }', { id })).result
    if (s.status === 'COMPLETED' || s.status === 'FAILED') {
      assert.equal(s.status, 'COMPLETED')
      return { id, warnings: s.warnings }
    }
    await page.sleep(1000)
  }
  assert.fail('the analysis did not finish; is the analysis worker running?')
}

const concept = (dataset, options = {}) => ({ reference: { type: 'CONCEPT', conceptId: String(dataset.concept) }, ...options })

let browser, page, analysisId, messages
before(async () => {
  browser = await launchBrowser({ height: 2400 }); page = browser.page
  await loginAs(page, 'writer')
  ;({ id: analysisId, warnings: messages } = await analyse('E2E messages', {
    datasetIds: [HEIGHT, LIGHT, WIDTH].map((d) => String(d.id)),
    descriptiveStatistics: { terms: [concept(HEIGHT, { aggregation: 'MEAN' }), concept(WIDTH, { aggregation: 'MEAN' })] },
    exclusions: [{ unitIds: ['999999999'] }, { unitIds: [String(r.units['Rep A1'])] }]
  }))
})
after(async () => {
  try {
    for (const id of analysisIds) await graphql(page, 'mutation ($id: ID!) { analysisDelete(id: $id) { status } }', { id })
    await logout(page)
  } finally {
    await browser?.close()
  }
})

// the text of the warning at a path
const warning = (code, ...path) => {
  const found = messages.find((m) => m.code === code && q(m.path.slice(-path.length)) === q(path))
  assert.ok(found, `a ${code} warning at ${path.join('.')} in ${q(messages)}`)
  return found.message
}

const texts = (root) => `[...(${root})?.querySelectorAll('.field-errors .message') ?? []].map((m) => m.textContent.replace(/\\s+/g, ' ').trim())`
const termBox = (conceptName) => `[...document.querySelectorAll('#analysis-terms .term')].find((t) => t.querySelector('.term-header strong')?.textContent.trim() === ${q(conceptName)})`
const datasetRow = (dataset) => `document.querySelector('#analysis-data .dataset-row input[value="${dataset.id}"]')?.closest('.dataset-row')`
const rules = `[...document.querySelectorAll('#analysis-exclusions .rule')]`
const navCounts = () => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.section-nav .nav-item')].map((b) => [b.firstChild.textContent.trim(), Number(b.querySelector('.nav-count')?.textContent ?? 0)]))`)

async function openEditor (id = analysisId, ready = `${termBox(r.concepts.width.name)} && ${datasetRow(WIDTH)}`) {
  await page.goto(`${config.appUrl}/analysis?id=${id}`)
  const edit = `[...document.querySelectorAll('.submission-view .header-actions button')].find((b) => b.innerText.includes('Edit'))`
  await page.waitFor(`${edit} && !${edit}.disabled && document.querySelector('.submission-view .analysis-messages')`, 30000)
  await page.evaluate(`${edit}.click()`)
  await page.waitFor(ready, 30000)
}

const termMessages = (concept) => page.evaluate(texts(termBox(concept.name)))
const datasetMessages = (dataset) => page.evaluate(texts(datasetRow(dataset)))
const ruleFeedback = () => page.evaluate(`${rules}.map((rule) => rule.querySelector('.feedback')?.textContent.replace(/\\s+/g, ' ').trim() ?? null)`)

test('messages stay on their terms, datasets and rules as others are removed in the editor', async () => {
  await openEditor()
  const mark = page.mark()
  const heightPooled = warning('REPLICATES_POOLED', 'terms', '0', 'replicateAggregation')
  const widthPooled = warning('REPLICATES_POOLED', 'terms', '1', 'replicateAggregation')
  const unused = warning('UNUSED_DATASET', 'datasetIds', '1')
  const matched = (rule) => Number(warning('EXCLUDED_BY_CONFIG', 'exclusions', String(rule)).match(/\d+ records/)?.[0].split(' ')[0])
  assert.equal(matched(0), 0, 'the first rule matched nothing')
  assert.ok(matched(1) > 0, 'the second rule matched records')

  // as loaded
  assert.ok((await termMessages(r.concepts.height)).some((m) => m.includes(heightPooled)))
  assert.ok((await termMessages(r.concepts.width)).some((m) => m.includes(widthPooled)))
  assert.ok((await datasetMessages(LIGHT)).some((m) => m.includes(unused)))
  assert.deepEqual(await datasetMessages(WIDTH), [])
  assert.deepEqual(await ruleFeedback(), ['Last run: 0 records excluded — check the criteria', `Last run: ${matched(1)} records excluded`])
  assert.deepEqual(await navCounts(), { Data: 1, Grouping: 0, Terms: 2, 'Descriptive statistics options': 0, Exclusions: 2 })
  // warnings, not errors
  assert.ok(await page.evaluate(`${termBox(r.concepts.width.name)}.classList.contains('has-warning')`))
  assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.section-nav .nav-count')].map((c) => c.classList.contains('warning'))`), [true, true, true])

  // the height term removed: the width term keeps its own warning only
  await page.evaluate(`[...${termBox(r.concepts.height.name)}.querySelectorAll('.term-header button')].find((b) => b.innerText.trim() === 'Remove').click()`)
  await page.waitFor(`!${termBox(r.concepts.height.name)}`)
  const widthMessages = await termMessages(r.concepts.width)
  assert.ok(widthMessages.some((m) => m.includes(widthPooled)), q(widthMessages))
  assert.ok(!widthMessages.some((m) => m.includes(heightPooled)), q(widthMessages))

  // the height dataset, first, deselected: the light dataset keeps its warning and the width dataset has none
  await page.click(`#analysis-data .dataset-row input[value="${HEIGHT.id}"]`)
  await page.waitFor(`!document.querySelector('#analysis-data .dataset-row input[value="${HEIGHT.id}"]').checked`)
  assert.ok((await datasetMessages(LIGHT)).some((m) => m.includes(unused)), 'the light dataset keeps its warning')
  assert.deepEqual(await datasetMessages(WIDTH), [], 'the width dataset has none')

  // the first rule removed: the second, now the first, keeps its count
  await page.evaluate(`${rules}[0].querySelector('.box-header .btn-link.danger').click()`)
  await page.waitFor(`${rules}.length === 1`)
  assert.deepEqual(await ruleFeedback(), [`Last run: ${matched(1)} records excluded`])
  assert.deepEqual(await navCounts(), { Data: 1, Grouping: 0, Terms: 1, 'Descriptive statistics options': 0, Exclusions: 1 })
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test('messages and the fields they are about are named, and the rules numbered as the editor shows them', async () => {
  const pooled = (concept) => `Replicates of concept '${concept.name}' are pooled by the MEAN aggregation`
  assert.ok(warning('REPLICATES_POOLED', 'terms', '0', 'replicateAggregation').startsWith(pooled(r.concepts.height)))
  assert.ok(warning('REPLICATES_POOLED', 'terms', '1', 'replicateAggregation').startsWith(pooled(r.concepts.width)))
  assert.equal(warning('UNUSED_DATASET', 'datasetIds', '1'),
    `The concept of dataset '${r.concepts.light.name}' (#${LIGHT.id}) is not used by any term, its records are ignored`)
  assert.equal(warning('EXCLUDED_BY_CONFIG', 'exclusions', '0'), 'Exclusion rule 1 matched 0 records')
  assert.match(warning('EXCLUDED_BY_CONFIG', 'exclusions', '1'), /^Exclusion rule 2 matched [1-9]\d* records$/)

  await page.goto(`${config.appUrl}/analysis?id=${analysisId}`)
  const fields = `[...document.querySelectorAll('.submission-view .analysis-messages li')].map((li) => li.querySelector('.btn-link')?.textContent.trim()).sort()`
  const expected = [
    `${r.concepts.height.name} › replicate aggregation`,
    `${r.concepts.width.name} › replicate aggregation`,
    `${r.concepts.light.name} (#${LIGHT.id})`,
    'Exclusion rule 1',
    'Exclusion rule 2'
  ].sort()
  // once the names have loaded
  await page.waitFor(`${q(q(expected))} === JSON.stringify(${fields})`, 30000).catch(() => {})
  assert.deepEqual(await page.evaluate(fields), expected)
})

test('removing a dataset from the results keeps the messages of the others in place', async () => {
  await page.goto(`${config.appUrl}/analysis?id=${analysisId}`)
  const remove = `[...document.querySelectorAll('.submission-view .analysis-messages button')].find((b) => b.innerText.startsWith('Remove'))`
  await page.waitFor(remove, 30000)
  const mark = page.mark()
  await page.evaluate(`${remove}.click()`)
  await page.waitFor(`${termBox(r.concepts.width.name)} && ${datasetRow(WIDTH)}`, 30000)
  assert.equal(await page.evaluate(`document.querySelector('#analysis-data .dataset-row input[value="${LIGHT.id}"]').checked`), false, 'the light dataset is removed')
  assert.ok((await termMessages(r.concepts.height)).some((m) => m.includes(warning('REPLICATES_POOLED', 'terms', '0', 'replicateAggregation'))))
  assert.ok((await termMessages(r.concepts.width)).some((m) => m.includes(warning('REPLICATES_POOLED', 'terms', '1', 'replicateAggregation'))))
  assert.deepEqual([...await datasetMessages(LIGHT), ...await datasetMessages(WIDTH), ...await datasetMessages(HEIGHT)], [])
  assert.equal((await navCounts()).Data, 0)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
