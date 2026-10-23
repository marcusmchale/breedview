// The curation table's row layouts (src/composables/datasets/curationRows.js): which records share a row in each view
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutRows, periodOf, recordTimeLabel, rowPlacement } from '../../src/composables/datasets/curationRows.js'

let nextRecord = 1
const record = (conceptId, start, end = null, extra = {}) =>
  ({ kind: 'variable', unitId: '2', conceptId, recordId: nextRecord++, start, end, codes: {}, ...extra })
// each row as [start, end, the concepts of its records]
const shape = (rows) => rows.map((row) => [row.start, row.end, row.entries.map((entry) => entry.conceptId)])

// a plot of the demonstration's 2024 study: four variables, each measured on a day of its own
const plot = [
  record('heading', '2024-06-03'), record('septoria', '2024-06-10'), record('height', '2024-06-20'),
  record('yield', '2024-08-12')
]

test('by time a row for each day; by month and by year, the records of a period share a row', () => {
  assert.deepEqual(shape(layoutRows(plot, 'time')), [
    ['2024-06-03', null, ['heading']], ['2024-06-10', null, ['septoria']], ['2024-06-20', null, ['height']],
    ['2024-08-12', null, ['yield']]
  ])
  assert.deepEqual(shape(layoutRows(plot, 'month')), [
    ['2024-06', null, ['heading', 'septoria', 'height']], ['2024-08', null, ['yield']]
  ])
  assert.deepEqual(shape(layoutRows(plot, 'year')), [['2024', null, ['heading', 'septoria', 'height', 'yield']]])
  assert.deepEqual(layoutRows(plot, 'year').map((row) => row.period), ['2024'])
})

test('a second record of a concept in a period starts another row, the first records first', () => {
  const later = record('height', '2024-06-01')
  const earlier = record('height', '2024-04-01')
  const between = record('septoria', '2024-05-01')
  assert.deepEqual(shape(layoutRows([later, between, earlier], 'year')), [
    ['2024', null, ['height', 'septoria']], ['2024', null, ['height']]
  ])
  const [first, second] = layoutRows([later, between, earlier], 'year')
  assert.equal(first.entries[0], earlier)
  assert.equal(second.entries[0], later)
  assert.notEqual(first.rowId, second.rowId)
})

test('a record across periods, or with no time, keeps a row of its own times', () => {
  const season = record('nitrogen', '2023-10-12', '2024-08-12')
  const undated = record('fungicide', null)
  // rows come in the order their first records are placed: by time, the undated first
  assert.deepEqual(shape(layoutRows([season, undated, ...plot], 'year')), [
    [null, null, ['fungicide']], ['2023-10-12', '2024-08-12', ['nitrogen']],
    ['2024', null, ['heading', 'septoria', 'height', 'yield']]
  ])
})

test('records of different group codes, and factor and variable records, never share a row', () => {
  const codesKey = (entry) => entry.codes.replicate ?? ''
  const first = record('height', '2024-06-20', null, { codes: { replicate: '1' } })
  const second = record('width', '2024-06-21', null, { codes: { replicate: '2' } })
  const factor = record('nitrogen', '2024-06-20', null, { kind: 'factor' })
  assert.deepEqual(shape(layoutRows([first, second, factor], 'year', codesKey)), [
    ['2024', null, ['height']], ['2024', null, ['nitrogen']], ['2024', null, ['width']]
  ])
  assert.deepEqual(shape(layoutRows([first, second], 'year')), [['2024', null, ['height', 'width']]])
})

test('by record, each record is a row of its own times', () => {
  const same = [record('height', '2024-06-20'), record('septoria', '2024-06-20')]
  assert.deepEqual(shape(layoutRows(same, 'time')), [['2024-06-20', null, ['height', 'septoria']]])
  assert.deepEqual(shape(layoutRows(same, 'record')), [
    ['2024-06-20', null, ['height']], ['2024-06-20', null, ['septoria']]
  ])
  assert.ok(layoutRows(same, 'record').every((row) => row.period === null))
})

test("a record's period: its start's and end's when they agree, at most as precise as the time", () => {
  assert.equal(periodOf('2024-06-10', null, 'month'), '2024-06')
  assert.equal(periodOf(null, '2024-06-10', 'year'), '2024')
  assert.equal(periodOf('2024', null, 'month'), '2024')
  assert.equal(periodOf('2024-06-10T10:00', '2024-06-10T11:30', 'day'), '2024-06-10')
  assert.equal(periodOf('2024-06-10 10:00:00', null, 'day'), '2024-06-10')
  assert.equal(periodOf('2024-06-10', '2024-06-11', 'day'), null)
  assert.equal(periodOf(null, null, 'year'), null)
  assert.equal(periodOf('2024-06-10', null, 'time'), null)
  assert.deepEqual(rowPlacement(record('height', '2024-06-10'), 'day'), {
    key: '2-period-2024-06-10', start: '2024-06-10', end: null, period: '2024-06-10'
  })
})

test("a cell's own time, as its title gives it", () => {
  assert.equal(recordTimeLabel('2024-06-10', null), 'Recorded 2024-06-10')
  assert.equal(recordTimeLabel('2024-03', '2024-08'), 'Recorded 2024-03 to 2024-08')
  assert.equal(recordTimeLabel(null, null), 'Recorded with no time')
})
