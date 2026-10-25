// The times of the values in the dataset submission table (useDatasetTable, DatasetTableModal), and the order of its
// rows. A value takes its column's time, if the column has one, or else its row's Start and End: a field sheet often
// gives a date for each variable, and another column of a variable holds its values at another time. The column's
// time wins, so that columns of one variable at different times keep them in a row that has a Start of its own.
// Rows come unit by unit, or round by round: every unit once, then again, as a sheet with a row for each unit on each
// visit. Imports nothing from Vue or the app, so it can be tested alone.
import { periodEnd, periodStart } from '../parsers/partialDatetime.js'

export const ROW_ORDERS = [
  { value: 'unit', label: 'Unit by unit', pattern: 'A A B B' },
  { value: 'round', label: 'Round by round', pattern: 'A B A B' }
]

/** The table's rows as { unit, round }, rounds from 1: unit by unit (A1 A2 B1 B2) or round by round (A1 B1 A2 B2) */
export function tableRows (units, rowsPerUnit = 1, order = 'unit') {
  const rounds = Math.max(1, Math.floor(Number(rowsPerUnit) || 1))
  const rows = []
  if (order === 'round') {
    for (let round = 1; round <= rounds; round++) units.forEach((unit) => rows.push({ unit, round }))
  } else {
    units.forEach((unit) => { for (let round = 1; round <= rounds; round++) rows.push({ unit, round }) })
  }
  return rows
}

const given = (value) => String(value ?? '').trim()

/** Whether a column has a time of its own: a start, an end or both */
export const hasTime = (column) => !!(given(column?.start) || given(column?.end))

/** A value's time, { start, end, from }: its column's ('column'), or else its row's ('row'), or none (from null) */
export function valueTime (row, column) {
  if (hasTime(column)) return { start: given(column.start), end: given(column.end), from: 'column' }
  const start = given(row?.startTime)
  const end = given(row?.endTime)
  return { start, end, from: start || end ? 'row' : null }
}

/** A time as shown: 2026-06-16, 2026-06-16 – 2026-06-18, until 2026-06-18, or '' */
export function timeLabel ({ start, end } = {}) {
  const from = given(start)
  const to = given(end)
  if (from && to) return `${from} – ${to}`
  if (from) return from
  return to ? `until ${to}` : ''
}

// a partial time as far as it is typed: what typing more could make YYYY, YYYY-MM, … or YYYY-MM-DDTHH:MM:SS
const TYPED = /^(\d{0,4}|\d{4}-\d{0,2}|\d{4}-\d{2}-\d{0,2}|\d{4}-\d{2}-\d{2}T\d{0,2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{0,2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{0,2})$/

/** Whether a time being typed could still become one, as 2026-0 can: its format is then not yet wrong */
export const partlyTyped = (value) => TYPED.test(given(value))

/** Why a start and end can't be a time, or null: the end must come after the start */
export function timeOrderError ({ start, end } = {}) {
  const from = periodStart(given(start))
  const to = periodEnd(given(end))
  return from != null && to != null && to <= from ? 'The end is before the start' : null
}

// A variable's columns: the first keyed concept_<id>, as the table always had it, the others concept_<id>_<n>
export const columnKey = (conceptId, n = 1) => (n === 1 ? `concept_${conceptId}` : `concept_${conceptId}_${n}`)

/** A column for each variable, with no time of its own */
export const firstColumns = (conceptIds) =>
  conceptIds.map((conceptId) => ({ key: columnKey(conceptId), conceptId: String(conceptId), n: 1, start: '', end: '' }))

/** The columns with another of the variable's, for another time, after its last; and the new column's key */
export function addColumn (columns, conceptId) {
  const own = columns.filter((column) => column.conceptId === String(conceptId))
  const n = Math.max(0, ...own.map((column) => column.n)) + 1
  const column = { key: columnKey(conceptId, n), conceptId: String(conceptId), n, start: '', end: '' }
  const after = own.length ? columns.indexOf(own[own.length - 1]) + 1 : columns.length
  return { columns: [...columns.slice(0, after), column, ...columns.slice(after)], key: column.key }
}

/**
 * The keys of the columns that share a variable and a time with another: they would give a unit's records twice. Two
 * without a time of their own share the rows' times.
 */
export function sameTimeColumns (columns) {
  const byTime = new Map()
  for (const column of columns) {
    const time = hasTime(column) ? `${given(column.start)}|${given(column.end)}` : 'rows'
    const key = `${column.conceptId}|${time}`
    byTime.set(key, [...(byTime.get(key) ?? []), column.key])
  }
  return new Set([...byTime.values()].filter((keys) => keys.length > 1).flat())
}

/**
 * A variable's values from all its columns, column by column, each with its time and where it was entered:
 * [{ unitId, start, end, value, rowIndex, columnKey }]. Empty cells give none.
 */
export function columnValues (rows, columns, conceptId) {
  const values = []
  for (const column of columns.filter((c) => c.conceptId === String(conceptId))) {
    rows.forEach((row, rowIndex) => {
      const value = row[column.key]
      if (value === '' || value === null || value === undefined) return
      const { start, end } = valueTime(row, column)
      values.push({ unitId: row.unitId, start, end, value, rowIndex, columnKey: column.key })
    })
  }
  return values
}
