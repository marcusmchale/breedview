/*
 * How the curation table lays its records out in rows (useDatasetCurationTable), by the view the user chooses:
 * - record: a row for each record, so that its own start and end can be edited;
 * - time: a unit's records at the same start and end share a row (as the table always did);
 * - day, month, year: a unit's records within the same period share a row, which shows the period ('2024'). A record
 *   that spans more than one period keeps a row of its own times, as does one with no time.
 * Records of different group codes never share a row, nor factor records with variable records, and a row holds one
 * record of each concept: a second record of one in the same place starts another row.
 *
 * A record is an entry: { kind: 'factor' | 'variable', unitId, conceptId, recordId, start, end, codes }, with its
 * times as the API gives them (partial datetimes: '2024', '2024-06', '2024-06-10', or with a time of day).
 */

export const ROW_MODES = [
  { value: 'record', label: 'One per record' },
  { value: 'time', label: 'Same time' },
  { value: 'day', label: 'Same day' },
  { value: 'month', label: 'Same month' },
  { value: 'year', label: 'Same year' }
]
export const DEFAULT_ROW_MODE = 'time'

// The length of a partial datetime of each period: YYYY-MM-DD, YYYY-MM, YYYY
const PERIOD_LENGTHS = { day: 10, month: 7, year: 4 }

export const isPeriodMode = (mode) => mode in PERIOD_LENGTHS

/**
 * The period of a mode that a record's start and end fall in, written as a partial datetime ('2024-06'): null when
 * they fall in different periods, or the record has no time. A time less precise than the mode is its own period: a
 * record of '2024' is in the period '2024' when rows are by month.
 */
export const periodOf = (start, end, mode) => {
  const length = PERIOD_LENGTHS[mode]
  if (!length) return null
  const from = start ? String(start).slice(0, length) : null
  const to = end ? String(end).slice(0, length) : null
  if (from && to) return from === to ? from : null
  return from || to
}

/** Where a record goes: { key, start, end, period }, the row's times being the period's where it has one */
export const rowPlacement = (entry, mode, codesKey = '') => {
  const unit = `${entry.kind === 'factor' ? 'factor:' : ''}${entry.unitId}`
  if (mode === 'record') {
    return { key: `${unit}-record-${entry.recordId}`, start: entry.start ?? null, end: entry.end ?? null, period: null }
  }
  const codes = codesKey ? `-${codesKey}` : ''
  const period = periodOf(entry.start, entry.end, mode)
  if (period) return { key: `${unit}-period-${period}${codes}`, start: period, end: null, period }
  return {
    key: `${unit}-${entry.start || 'null'}-${entry.end || 'null'}${codes}`,
    start: entry.start ?? null,
    end: entry.end ?? null,
    period: null
  }
}

const ownTime = (entry) => `${entry.start || entry.end || ''}\u0000${entry.end || ''}`

/**
 * The rows of these records: [{ rowId, start, end, period, entries }], each holding at most one record of a concept.
 * codesKey(entry) gives what its group codes must share with the rest of its row. By period, a unit's records are
 * placed in time order, so the first row of a period holds its first records.
 */
export const layoutRows = (entries, mode, codesKey = () => '') => {
  const ordered = isPeriodMode(mode) ? [...entries].sort((a, b) => ownTime(a).localeCompare(ownTime(b))) : entries
  const byKey = new Map()
  const conceptsOf = new Map()  // row -> the concepts it holds a record of
  for (const entry of ordered) {
    const placement = rowPlacement(entry, mode, codesKey(entry))
    if (!byKey.has(placement.key)) byKey.set(placement.key, [])
    const rows = byKey.get(placement.key)
    let row = rows.find((r) => !conceptsOf.get(r).has(String(entry.conceptId)))
    if (!row) {
      const { key, ...times } = placement
      row = { rowId: rows.length === 0 ? key : `${key}-${rows.length}`, ...times, entries: [] }
      conceptsOf.set(row, new Set())
      rows.push(row)
    }
    conceptsOf.get(row).add(String(entry.conceptId))
    row.entries.push(entry)
  }
  return [...byKey.values()].flat()
}

/** A record's own time, as a cell of a row that stands for a period describes it */
export const recordTimeLabel = (start, end) => {
  if (!start && !end) return 'Recorded with no time'
  if (start && end && start !== end) return `Recorded ${start} to ${end}`
  return `Recorded ${start || end}`
}
