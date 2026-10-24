// The times of a dataset submission's values and the order of its rows (src/composables/datasets/submissionTimes.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addColumn, columnKey, columnValues, firstColumns, hasTime, sameTimeColumns, tableRows, timeLabel, timeOrderError,
  valueTime
} from '../../src/composables/datasets/submissionTimes.js'

test('rows come unit by unit, or round by round: every unit once, then again', () => {
  const order = (rows) => rows.map(({ unit, round }) => `${unit}${round}`)
  assert.deepEqual(order(tableRows(['A', 'B'], 2)), ['A1', 'A2', 'B1', 'B2'])
  assert.deepEqual(order(tableRows(['A', 'B'], 2, 'round')), ['A1', 'B1', 'A2', 'B2'])
  assert.deepEqual(order(tableRows(['A', 'B', 'C'], 1, 'round')), ['A1', 'B1', 'C1'])
  assert.deepEqual(order(tableRows(['A'], 0)), ['A1'], 'at least one row a unit')
})

test("a value takes its column's time, if it has one, or else its row's", () => {
  const row = { startTime: '2026-06-03', endTime: '' }
  assert.deepEqual(valueTime(row, { start: '2026-06-25', end: '' }), { start: '2026-06-25', end: '', from: 'column' })
  assert.deepEqual(valueTime(row, { start: '', end: '2026-07' }), { start: '', end: '2026-07', from: 'column' },
    "an end alone is the column's time: the row's start is not taken with it")
  assert.deepEqual(valueTime(row, { start: '', end: '' }), { start: '2026-06-03', end: '', from: 'row' })
  assert.deepEqual(valueTime({ startTime: ' ', endTime: '' }, { start: '', end: '' }), { start: '', end: '', from: null })
  assert.equal(hasTime({ start: ' ', end: '' }), false)
})

test('times are shown as a start, a period or an end', () => {
  assert.equal(timeLabel({ start: '2026-06-16' }), '2026-06-16')
  assert.equal(timeLabel({ start: '2026-06-16', end: '2026-06-18' }), '2026-06-16 – 2026-06-18')
  assert.equal(timeLabel({ end: '2026-06-18' }), 'until 2026-06-18')
  assert.equal(timeLabel({}), '')
})

test('an end before its start is refused, at the precision each was given', () => {
  assert.equal(timeOrderError({ start: '2026-06-16', end: '2026-06-15' }), 'The end is before the start')
  assert.equal(timeOrderError({ start: '2026-06-16', end: '2026-06-16' }), null, 'a day, ending when it ends')
  assert.equal(timeOrderError({ start: '2026-06', end: '2026-06-01' }), null)
  assert.equal(timeOrderError({ start: '2026-06-16' }), null)
})

test("another column of a variable comes after its last, and the variable's columns may not share a time", () => {
  let columns = firstColumns(['7', '8'])
  assert.deepEqual(columns.map((column) => column.key), [columnKey('7'), columnKey('8')])
  assert.deepEqual(columns.map((column) => column.key), ['concept_7', 'concept_8'])
  let key
  ;({ columns, key } = addColumn(columns, '7'))
  assert.equal(key, 'concept_7_2')
  ;({ columns } = addColumn(columns, '7'))
  assert.deepEqual(columns.map((column) => column.key), ['concept_7', 'concept_7_2', 'concept_7_3', 'concept_8'])

  // all three of 7 take the rows' times: each would give a unit's records twice
  assert.deepEqual([...sameTimeColumns(columns)].sort(), ['concept_7', 'concept_7_2', 'concept_7_3'])
  columns = columns.map((column) => (column.key === 'concept_7_2' ? { ...column, start: '2026-06-25' } : column))
  columns = columns.map((column) => (column.key === 'concept_7_3' ? { ...column, start: '2026-07-10' } : column))
  assert.deepEqual([...sameTimeColumns(columns)], [])
  columns = columns.map((column) => (column.key === 'concept_8' ? { ...column, start: '2026-06-25' } : column))
  assert.deepEqual([...sameTimeColumns(columns)], [], 'other variables may have the same time')
})

test("a variable's values come from all its columns, each with its time and the cell it was entered in", () => {
  const columns = [
    { key: 'concept_7', conceptId: '7', n: 1, start: '2026-06-25', end: '' },
    { key: 'concept_8', conceptId: '8', n: 1, start: '', end: '' },
    { key: 'concept_7_2', conceptId: '7', n: 2, start: '2026-07-10', end: '' }
  ]
  const rows = [
    { unitId: '1', startTime: '2026-06-03', endTime: '', concept_7: '84', concept_8: '3', concept_7_2: '91' },
    { unitId: '2', startTime: '', endTime: '', concept_7: '', concept_8: '4', concept_7_2: '88' }
  ]
  assert.deepEqual(columnValues(rows, columns, '7'), [
    { unitId: '1', start: '2026-06-25', end: '', value: '84', rowIndex: 0, columnKey: 'concept_7' },
    { unitId: '1', start: '2026-07-10', end: '', value: '91', rowIndex: 0, columnKey: 'concept_7_2' },
    { unitId: '2', start: '2026-07-10', end: '', value: '88', rowIndex: 1, columnKey: 'concept_7_2' }
  ])
  assert.deepEqual(columnValues(rows, columns, '8').map(({ start, value }) => [start, value]), [['2026-06-03', '3'], ['', '4']],
    "a column without a time takes each row's")
})
