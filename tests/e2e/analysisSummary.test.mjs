// An analysis's summary download (composables/analysis/useAnalysisSummary.js): a zip of a printable report, the
// settings as submitted and each result table as CSV. On the test database's replicates study (manifest
// `replicates`), as the writer: descriptive statistics of the tree heights and canopy widths, averaged per unit, and
// their correlation, whose heatmap the report carries. The download is caught in the page rather than saved. Needs the
// analysis worker (see README.md). The analyses are deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { replicates as r } from './lib/fixture.mjs'
import { unzip } from './lib/unzip.mjs'

const q = JSON.stringify
const HEIGHT = r.datasets.same_time
const WIDTH = r.datasets.width
const CC_BY = 'Creative Commons Attribution 4.0 International (CC BY 4.0)'

const analysisIds = []
// an analysis submitted, once it completes: its ID
async function analyse (analysis) {
  const submitted = await graphql(page, 'mutation ($a: AnalysisInput!) { analysisSubmit(analysis: $a) { status result errors { message } } }', { a: analysis })
  assert.equal(submitted.status, 'SUCCESS', q(submitted.errors))
  const id = String(submitted.result)
  analysisIds.push(id)
  for (let i = 0; i < 120; i++) {
    const s = (await graphql(page, 'query ($id: ID!) { analysisSubmission(id: $id) { result { status errors { message } } } }', { id })).result
    if (s.status === 'COMPLETED' || s.status === 'FAILED') {
      assert.equal(s.status, 'COMPLETED', q(s.errors))
      return id
    }
    await page.sleep(1000)
  }
  assert.fail('the analysis did not finish; is the analysis worker running?')
}

const concept = (dataset) => ({ reference: { type: 'CONCEPT', conceptId: String(dataset.concept) }, aggregation: 'MEAN' })
const datasetIds = [HEIGHT, WIDTH].map((d) => String(d.id))

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 2000 }); page = browser.page
  await loginAs(page, 'writer')
})
after(async () => {
  try {
    for (const id of analysisIds) await graphql(page, 'mutation ($id: ID!) { analysisDelete(id: $id) { status } }', { id })
    await logout(page)
  } finally {
    await browser?.close()
  }
})

const button = `[...document.querySelectorAll('.submission-view .header-actions button')].find((b) => b.innerText.includes('Download summary'))`

// the analysis's page opened, its summary downloaded, and the zip read: its file name and files
async function downloadSummary (id) {
  await page.goto(`${config.appUrl}/analysis?id=${id}`)
  await page.waitFor(`${button} && !${button}.disabled && document.querySelector('.submission-view .result-table')`, 60000)
  await page.sleep(500)
  // the blob read as it is made, and the link's click caught, so nothing is saved
  await page.evaluate(`(() => {
    window.__summary = null; window.__downloadName = null
    const create = URL.createObjectURL
    URL.createObjectURL = (blob) => {
      blob.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer); let text = ''
        for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
        window.__summary = { type: blob.type, base64: btoa(text) }
      })
      return create.call(URL, blob)
    }
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__downloadName = this.download; return } return click.call(this) }
  })()`)
  await page.evaluate(`${button}.click()`)
  await page.waitFor('window.__summary && window.__downloadName', 30000)
  const { type, base64 } = await page.evaluate('window.__summary')
  assert.equal(type, 'application/zip')
  return { name: await page.evaluate('window.__downloadName'), files: unzip(Buffer.from(base64, 'base64')) }
}

test('a descriptive analysis downloads as a report, its settings and a CSV a term', async () => {
  const id = await analyse({
    analysisType: 'DESCRIPTIVE_STATISTICS', name: 'E2E summary', datasetIds,
    descriptiveStatistics: { terms: [concept(HEIGHT), concept(WIDTH)] }
  })
  const mark = page.mark()
  const { name, files } = await downloadSummary(id)
  assert.equal(name, `analysis-${id}-descriptive-statistics.zip`)
  assert.deepEqual(Object.keys(files), ['summary.html', 'analysis.json', 'descriptive-1.csv', 'descriptive-2.csv'])

  const settings = JSON.parse(files['analysis.json'])
  assert.deepEqual([settings.id, settings.analysisType, settings.datasetIds], [id, 'DESCRIPTIVE_STATISTICS', datasetIds])
  assert.equal(settings.config.terms.length, 2)
  assert.ok(!files['analysis.json'].includes('__typename'))

  const report = files['summary.html']
  assert.match(report, /<title>E2E summary<\/title>/)
  for (const text of [r.concepts.height.name, r.concepts.width.name, r.study.name, CC_BY, 'Downloaded', 'descriptive-1.csv']) {
    assert.ok(report.includes(text), `the report names ${text}`)
  }

  const [header, overall] = files['descriptive-1.csv'].replace(/^\uFEFF/, '').split('\r\n')
  assert.equal(header, 'Levels,n,Missing,Mean,SD,SE,Min,Q1,Median,Q3,Max')
  assert.match(overall, /^All observations,\d+,\d+,/)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})

test("a correlation's summary carries its matrix and its heatmap", async () => {
  const id = await analyse({
    analysisType: 'CORRELATION', name: 'E2E correlation summary', datasetIds,
    correlation: { terms: [concept(HEIGHT), concept(WIDTH)], method: 'PEARSON' }
  })
  const { files } = await downloadSummary(id)
  assert.deepEqual(Object.keys(files), ['summary.html', 'analysis.json', 'correlation.csv'])
  const rows = files['correlation.csv'].replace(/^\uFEFF/, '').trim().split('\r\n')
  assert.equal(rows.length, 3, 'a header and a row a term')
  assert.match(rows[1], /,1(,|$)/, 'a term correlates with itself')
  assert.match(files['summary.html'], /<div class="chart"><svg[^>]*role="img"[^>]*aria-label="Correlation matrix"/)
})

test("an ANOVA's summary has its table, estimated means and contrasts, the record group levels named", async () => {
  const height = { type: 'CONCEPT', conceptId: String(r.concepts.height.id) }
  const block = { type: 'RECORD_GROUP', recordGroupDimension: 'block' }
  const id = await analyse({
    analysisType: 'ANOVA', name: 'E2E ANOVA summary', datasetIds: [String(r.datasets.blocks.id)],
    anova: {
      terms: [{ reference: height }, { reference: block }],
      response: height,
      grouping: { recordGroups: [{ name: 'block', groupingIds: [String(r.groupings['Study Scoped Block'].id)] }] },
      estimatedMeans: [{ terms: [block], contrast: 'PAIRWISE', adjustment: 'TUKEY' }]
    }
  })
  const mark = page.mark()
  const { files } = await downloadSummary(id)
  assert.deepEqual(Object.keys(files), ['summary.html', 'analysis.json', 'anova.csv', 'estimated-means.csv', 'contrasts.csv'])
  const lines = (file) => files[file].replace(/^\uFEFF/, '').trim().split('\r\n')
  assert.equal(lines('anova.csv')[0], 'Term,df,Sum of squares,Mean square,F,p')
  assert.match(lines('anova.csv').at(-1), /^Residual,\d+,/)
  assert.ok(files['summary.html'].includes(`of ${r.concepts.height.name}`), 'the model is named by its response')

  // a block's codes mean something only within a unit graph: its levels are named, the code with its graph's root,
  // on the page and in the summary, rather than given as their keys (breedgraph RecordGroupLevelKey)
  const chartLabels = await page.evaluate(`[...document.querySelectorAll('.estimated-means svg text')].map((t) => t.textContent)`)
  assert.ok(chartLabels.length > 0 && chartLabels.every((label) => !label.includes('|')), `the chart's labels: ${chartLabels}`)
  const contrasts = lines('contrasts.csv').slice(1)
  assert.ok(contrasts.length > 0)
  for (const row of contrasts) assert.match(row.split(',')[0], /^[^|]*: Block \d+ of [^|]+ − [^|]*: Block \d+ of [^|]+$/)
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
