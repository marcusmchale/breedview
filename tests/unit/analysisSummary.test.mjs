// An analysis's summary download: its result tables (src/composables/analysis/summaryTables.js), their CSV
// (src/composables/system/csv.js), the printable report (summaryReport.js) and the zip that holds them (zip.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv } from '../../src/composables/system/csv.js'
import { crc32, zipStored } from '../../src/composables/system/zip.js'
import { analysisSettings, groupingDimensions, resultTables } from '../../src/composables/analysis/summaryTables.js'
import { escapeHtml, formatCell, summaryReport } from '../../src/composables/analysis/summaryReport.js'
import { unzip } from '../e2e/lib/unzip.mjs'

// names as useAnalysisNames gives them, kept simple
const NAMES = { 1: 'Plant height (cm)', 2: 'Disease score' }
const termLabel = (ref) => {
  if (ref.type === 'CONCEPT') return NAMES[ref.conceptId]
  if (ref.type === 'RECORD_GROUP') return ref.recordGroupDimension.name
  return ref.type.toLowerCase()
}
const levelsLabel = (levels) => levels.map((l) => `${termLabel(l.term)} ${l.level}`).join(', ')
const groupLabel = (group) => `Unit ${group.unitId}`
const termKey = (ref) => `${ref.type}:${ref.conceptId ?? ''}`
const labels = { termLabel, levelsLabel, groupLabel, termKey }

const HEIGHT = { type: 'CONCEPT', conceptId: '1' }
const SCORE = { type: 'CONCEPT', conceptId: '2' }
const GERMPLASM = { type: 'GERMPLASM' }
const BLOCK = { type: 'RECORD_GROUP', recordGroupDimension: { name: 'Block' } }

test('a CSV quotes what needs it, writes numbers in full and missing values as empty cells', () => {
  const csv = toCsv(['Level', 'Mean'], [['A, B', 1.23456789012345], ['say "hi"', null], ['line\nbreak', NaN]])
  assert.equal(csv, '\uFEFFLevel,Mean\r\n"A, B",1.23456789012345\r\n"say ""hi""",\r\n"line\nbreak",\r\n')
})

test('text a spreadsheet would take for a formula is written as text', () => {
  const csv = toCsv(['Name'], [['=HYPERLINK("x")'], ['+1'], ['-1'], ['@SUM(A1)'], ['plain']])
  assert.deepEqual(csv.slice(1).split('\r\n').slice(1, 6), ["\"'=HYPERLINK(\"\"x\"\")\"", "'+1", "'-1", "'@SUM(A1)", 'plain'])
  // a negative number stays a number
  assert.equal(toCsv(['x'], [[-1.5]]), '\uFEFFx\r\n-1.5\r\n')
})

test('the zip holds each file, stored, its CRC-32 as zlib computes it, with UTF-8 names', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
  const bytes = zipStored([
    { name: 'summary.html', data: '<p>Grüße</p>' },
    { name: 'données.csv', data: 'a,b\r\n1,2\r\n' },
    { name: 'empty.csv', data: '' }
  ], new Date(2026, 9, 29, 14, 30, 10))
  assert.deepEqual(unzip(bytes), { 'summary.html': '<p>Grüße</p>', 'données.csv': 'a,b\r\n1,2\r\n', 'empty.csv': '' })
  // MS-DOS time and date: 14:30:10 on 2026-10-29
  const view = new DataView(bytes.buffer)
  assert.equal(view.getUint16(10, true), (14 << 11) | (30 << 5) | 5)
  assert.equal(view.getUint16(12, true), ((2026 - 1980) << 9) | (10 << 5) | 29)
})

const anova = {
  __typename: 'AnovaResult',
  terms: [
    { term: GERMPLASM, degreesOfFreedom: 3, denominatorDegreesOfFreedom: null, sumOfSquares: 120.5, meanSquare: 40.1666666667, fStatistic: 8.03, pValue: 0.0021 },
    { term: BLOCK, degreesOfFreedom: 2, denominatorDegreesOfFreedom: null, sumOfSquares: 10, meanSquare: 5, fStatistic: 1, pValue: 0.4 }
  ],
  interactions: [],
  randomEffects: [],
  residual: { degreesOfFreedom: 6, sumOfSquares: 30, meanSquare: 5 },
  estimatedMeans: [{
    response: HEIGHT,
    terms: [GERMPLASM],
    by: [],
    contrast: 'PAIRWISE',
    adjustment: 'TUKEY',
    means: [
      { levels: [{ term: GERMPLASM, level: 'A' }], by: [], mean: 80.123456, standardError: 1.5, degreesOfFreedom: 6, lowerConfidenceLimit: 76.4, upperConfidenceLimit: 83.8 },
      { levels: [{ term: GERMPLASM, level: 'B' }], by: [], mean: 72, standardError: 1.5, degreesOfFreedom: 6, lowerConfidenceLimit: 68.3, upperConfidenceLimit: 75.7 }
    ],
    contrasts: [{
      label: 'A - B',
      levelsA: [{ term: GERMPLASM, level: 'A' }],
      levelsB: [{ term: GERMPLASM, level: 'B' }],
      by: [],
      estimate: 8.123456,
      standardError: 2.1,
      degreesOfFreedom: 6,
      statistic: 3.87,
      pValue: 0.0083,
      lowerConfidenceLimit: 3,
      upperConfidenceLimit: 13.2,
      significant: true
    }]
  }]
}
const anovaConfig = { response: HEIGHT, alpha: 0.05, sumOfSquares: 'TYPE_II', ddf: 'SATTERTHWAITE' }

test('an analysis of variance is its table, with the residual, then its estimated means and contrasts', () => {
  const [table, means, contrasts] = resultTables(anova, anovaConfig, labels)
  assert.equal(table.file, 'anova')
  assert.equal(table.title, 'Linear model of Plant height (cm)')
  assert.deepEqual(table.columns.map((c) => c.label), ['Term', 'df', 'Sum of squares', 'Mean square', 'F', 'p'])
  assert.deepEqual(table.rows, [
    ['germplasm', 3, 120.5, 40.1666666667, 8.03, 0.0021],
    ['Block', 2, 10, 5, 1, 0.4],
    ['Residual', 6, 30, 5, null, null]
  ])
  assert.deepEqual(table.significant, [true, false, false])

  assert.equal(means.file, 'estimated-means')
  assert.equal(means.title, 'Plant height (cm): means of germplasm')
  assert.deepEqual(means.rows[0], ['germplasm A', 80.123456, 1.5, 6, 76.4, 83.8])
  assert.equal(contrasts.file, 'contrasts')
  assert.deepEqual(contrasts.rows, [['germplasm A − germplasm B', 8.123456, 2.1, 6, 3.87, 0.0083, 3, 13.2, 'yes']])
  assert.match(contrasts.note, /Pairwise contrasts, p values adjusted by tukey/)
})

test('a mixed model adds denominator df, and its random effects are a table of their own', () => {
  const mixed = {
    ...anova,
    terms: [{ ...anova.terms[0], denominatorDegreesOfFreedom: 5.5 }],
    residual: null,
    randomEffects: [{ group: BLOCK, slope: null, variance: 2.25, standardDeviation: 1.5 }],
    estimatedMeans: []
  }
  const [table, random] = resultTables(mixed, anovaConfig, labels)
  assert.equal(table.title, 'Linear mixed model of Plant height (cm)')
  assert.deepEqual(table.columns.map((c) => c.label), ['Term', 'df', 'Denominator df', 'Sum of squares', 'Mean square', 'F', 'p'])
  assert.deepEqual(table.rows, [['germplasm', 3, 5.5, 120.5, 40.1666666667, 8.03, 0.0021]])
  assert.deepEqual(random.rows, [['Block', 'Intercept', 2.25, 1.5]])
})

test("descriptive statistics are a table a term, an ordinal term's categories each a count and a share", () => {
  const result = {
    __typename: 'DescriptiveStatisticsResult',
    terms: [
      { term: HEIGHT, levels: [], count: 6, missingCount: 0, mean: 80.5, standardDeviation: 2, standardError: 0.8, minimum: 77, lowerQuartile: 79, median: 80, upperQuartile: 82, maximum: 84, ordinal: null },
      {
        term: SCORE, levels: [], count: 4, missingCount: 1,
        ordinal: { categories: [{ level: '1', count: 1, share: 0.25 }, { level: '3', count: 3, share: 0.75 }], minimum: '1', lowerQuartile: '1', median: '3', upperQuartile: '3', maximum: '3' }
      }
    ],
    estimatedMeans: []
  }
  const [height, score] = resultTables(result, {}, labels)
  assert.deepEqual([height.file, score.file], ['descriptive-1', 'descriptive-2'])
  assert.deepEqual(height.rows, [['All observations', 6, 0, 80.5, 2, 0.8, 77, 79, 80, 82, 84]])
  assert.deepEqual(score.columns.slice(-4).map((c) => c.label), ['1: n', '1: share', '3: n', '3: share'])
  assert.deepEqual(score.rows, [['All observations', 4, 1, '1', '1', '3', '3', '3', 1, 0.25, 3, 0.75]])
})

test('a correlation is its matrix, an MDS its observations, and outlier detection its outliers', () => {
  const [correlation] = resultTables(
    { __typename: 'CorrelationResult', terms: [HEIGHT, SCORE], matrix: [{ term: HEIGHT, values: [1, -0.42] }, { term: SCORE, values: [-0.42, 1] }] },
    { correlationMethod: 'PEARSON' }, labels
  )
  assert.deepEqual(correlation.columns.map((c) => c.label), ['', 'Plant height (cm)', 'Disease score'])
  assert.deepEqual(correlation.rows[0], ['Plant height (cm)', 1, -0.42])

  const [mds] = resultTables({
    __typename: 'MDSResult',
    observations: [{ group: { unitId: '7' }, recordIds: ['1', '2'], coordinates: [0.5, -1.25], clusterId: '1' }]
  }, { distance: 'EUCLIDEAN' }, labels)
  assert.deepEqual(mds.columns.map((c) => c.label), ['Observation', 'Cluster', 'Dimension 1', 'Dimension 2', 'Records'])
  assert.deepEqual(mds.rows, [['Unit 7', '1', 0.5, -1.25, 2]])

  const [outliers] = resultTables({
    __typename: 'OutlierDetectionResult',
    outliers: [{ observation: { unitId: '9' }, term: HEIGHT, value: 140, score: 4.2 }, { observation: { unitId: '3' }, term: null, value: null, score: 30 }]
  }, { outlierMethod: 'Z_SCORE' }, labels)
  assert.deepEqual(outliers.rows, [['Unit 9', 'Plant height (cm)', 140, 4.2], ['Unit 3', 'All terms', null, 30]])
})

test('the settings name the terms, dimensions, model options, estimated means and exclusions', () => {
  const submission = {
    analysisType: 'ANOVA',
    exclusions: [{}, {}],
    config: {
      ...anovaConfig,
      terms: [{ reference: GERMPLASM }, { reference: BLOCK }],
      grouping: { time: null, germplasm: { germplasmIds: [] }, unit: null, position: null, recordGroups: [{ name: 'Block' }] },
      interactions: [{ terms: [GERMPLASM, BLOCK] }],
      estimatedMeans: [{ terms: [GERMPLASM], by: [], contrast: 'PAIRWISE', adjustment: 'TUKEY' }]
    }
  }
  const labelled = {
    termLabel,
    analysisTypeLabel: () => 'ANOVA',
    termTypeLabel: (type) => (type === 'GERMPLASM' ? 'Germplasm' : 'Record group'),
    subjectName: (id) => ({ 31: 'Plot', 32: 'Field' })[id]
  }
  const settings = Object.fromEntries(analysisSettings(submission, labelled))
  assert.equal(settings.Terms, 'germplasm (germplasm), Block (record group)')
  assert.equal(settings.Dimensions, "Germplasm (each unit's own), Record group: Block")
  assert.equal(settings.Response, 'Plant height (cm)')
  assert.equal(settings.Interactions, 'germplasm × Block')
  assert.equal(settings['Estimated means'], 'Means of germplasm, pairwise contrasts, tukey adjustment')
  assert.equal(settings.Exclusions, '2 rules')
  assert.equal(settings['Observation unit'], "Each record's unit")
  assert.deepEqual(groupingDimensions(null), [])

  // observed at plots or fields, the observation unit is a setting of its own, not a dimension; the dimensions come
  // in the editor's order
  submission.config.grouping = {
    ...submission.config.grouping,
    unit: { subjectIds: [31, 32] },
    time: { binning: { boundaries: ['2025-06-01'], labels: null } },
    position: { axes: ['Row'] }
  }
  const observed = Object.fromEntries(analysisSettings(submission, labelled))
  assert.equal(observed['Observation unit'], 'Nearest unit of Plot or Field')
  assert.equal(observed.Dimensions, "Germplasm (each unit's own), Location, Row, Time (2 bins), Record group: Block")
})

test('the report escapes every text, formats the tables, marks significant rows and lists the files', () => {
  const tables = resultTables(anova, anovaConfig, labels)
  const html = summaryReport({
    title: '<script>alert(1)</script> Yield',
    generated: new Date(Date.UTC(2026, 9, 29, 14, 30)),
    site: 'https://example.org/breedview/',
    analysis: { id: '12', type: 'ANOVA' },
    datasets: [
      { name: 'Plant height (cm) (#4)', study: 'Field & Lab 2025', licence: 'Creative Commons Attribution 4.0 International (CC BY 4.0)', credit: ['Wheat Group, Example & Co', 'Example Cooperative'] },
      { name: 'Score (#5)', study: 'Private', licence: null, credit: [] }
    ],
    settings: [['Type', 'ANOVA']],
    errors: [],
    warnings: ['The model did not <converge>'],
    tables,
    charts: ['<svg role="img"></svg>'],
    files: ['summary.html', 'analysis.json', 'anova.csv']
  })
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; Yield'))
  assert.ok(html.includes('Field &amp; Lab 2025'))
  assert.ok(html.includes('Creative Commons Attribution 4.0 International (CC BY 4.0)'))
  assert.ok(html.includes('None: private to the teams that hold it'))
  assert.ok(html.includes('<th>Credit</th>'))
  assert.ok(html.includes('<td>Wheat Group, Example &amp; Co; Example Cooperative</td>'))
  assert.ok(html.includes('The model did not &lt;converge&gt;'))
  assert.ok(html.includes('Downloaded 2026-10-29 14:30 UTC'))
  assert.match(html, /<tr class="significant"><td>germplasm<\/td>/)
  assert.ok(html.includes('<div class="chart"><svg role="img"></svg></div>'))
  assert.equal(formatCell(0.0001, 'p'), '< 0.001')
  assert.equal(formatCell(0.25, 'share'), '25%')
  assert.equal(formatCell('3', 'number'), '3')
  assert.equal(escapeHtml(`"'`), '&quot;&#39;')
})
