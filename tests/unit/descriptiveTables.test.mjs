// The tables of a descriptive statistics result (src/composables/analysis/descriptiveTables.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriptiveTables, columnValue, categoryCount } from '../../src/composables/analysis/descriptiveTables.js'

const HEIGHT = { type: 'CONCEPT', conceptId: '1' }
const SCORE = { type: 'CONCEPT', conceptId: '2' }
const ENTRY = { type: 'GERMPLASM' }
const keyOf = (term) => `${term.type}:${term.conceptId ?? ''}`
const ordinal = (counts, quantiles) => ({
  categories: Object.entries(counts).map(([level, count]) => ({ level, count, share: count / 6 })),
  ...quantiles
})

const SCORES = ordinal({ 1: 0, 3: 2, 5: 1, 7: 2, 9: 1 }, { minimum: '3', lowerQuartile: '3', median: '5', upperQuartile: '7', maximum: '9' })
const terms = [
  { term: SCORE, levels: [], count: 6, missingCount: 1, ordinal: SCORES },
  { term: HEIGHT, levels: [{ term: ENTRY, level: '5' }], count: 3, missingCount: 0, mean: 81.5, ordinal: null },
  { term: HEIGHT, levels: [], count: 6, missingCount: 0, mean: 80, ordinal: null },
  { term: SCORE, levels: [{ term: ENTRY, level: '5' }], count: 3, missingCount: 0, ordinal: { ...SCORES, median: '3' } }
]

test('each term described is a table, in the order given, its overall row first', () => {
  const [score, height] = descriptiveTables(terms, keyOf)
  assert.deepEqual([score.term, height.term], [SCORE, HEIGHT])
  assert.deepEqual(height.rows.map((row) => row.levels.length), [0, 1])
  assert.equal(height.ordinal, false)
  assert.ok(height.columns.some(([key]) => key === 'mean'))
})

test("an ordinal term's table has its quantiles as categories and a column for each category, but no mean", () => {
  const [score] = descriptiveTables(terms, keyOf)
  assert.equal(score.ordinal, true)
  assert.deepEqual(score.columns.map(([key]) => key), ['count', 'missingCount', 'minimum', 'lowerQuartile', 'median', 'upperQuartile', 'maximum'])
  assert.deepEqual(score.categories, ['1', '3', '5', '7', '9'])
  const [overall, entry] = score.rows
  assert.deepEqual(score.columns.map(([key]) => columnValue(overall, key)), [6, 1, '3', '3', '5', '7', '9'])
  assert.equal(columnValue(entry, 'median'), '3')
  assert.deepEqual(score.categories.map((level) => categoryCount(overall, level)), ['0 (0%)', '2 (33%)', '1 (17%)', '2 (33%)', '1 (17%)'])
  // nothing observed: counts without shares
  assert.equal(categoryCount({ ordinal: { categories: [{ level: '1', count: 0, share: null }] } }, '1'), '0')
})
