// The table of units placed at once (PlaceUnitsModal, unitsPlaceUnits): a row for each unit, with its germplasm, the
// layout it is in and its value on each of that layout's axes, typed or pasted from a spreadsheet. The layouts offered
// are the chosen one and those below it that have axes; each axis name is one column, shared by the layouts that have
// it. Names are matched ignoring case and surrounding space: germplasm by name or synonym (germplasmEntriesNamed), a
// layout by its name, or by its path from the chosen layout where names repeat. Only what changes is sent: a unit's
// position when it isn't at that place at the start already, as the API leaves such a unit as it is, and its germplasm
// when it differs from its own. Imports nothing from Vue or the app, so the unit tests can load it.
import { periodStart, periodEnd } from '../parsers/partialDatetime.js'

export const fold = (text) => String(text ?? '').trim().toLowerCase()

const naturally = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
/** Units in the order a field sheet lists them: by name, numbers in order (HF27-2 before HF27-10), then by id */
export const byUnitName = (a, b) =>
  naturally.compare(a.name ?? '', b.name ?? '') || naturally.compare(String(a.id), String(b.id))

/**
 * The layouts a table offers, from the tree below the chosen one (layouts: the chosen one and those below it, in any
 * order, with { id, name, axes, parent }): those with axes, the chosen one first, each with the label it is shown and
 * matched by, its name, or its path from the chosen one where another offered layout has the same name
 */
export const layoutChoices = (rootId, layouts) => {
  const byId = new Map(layouts.map((layout) => [String(layout.id), layout]))
  const isRoot = (layout) => String(layout.id) === String(rootId)
  // below the chosen layout, its name left out
  const path = (layout) => {
    const names = []
    for (let at = layout; at && (at === layout || !isRoot(at)); at = at.parent ? byId.get(String(at.parent.id)) : null) {
      names.unshift(at.name ?? `Layout ${at.id}`)
    }
    return names.join(' / ')
  }
  const offered = layouts
    .filter((layout) => layout.axes?.length)
    .sort((a, b) => (isRoot(a) ? -1 : isRoot(b) ? 1 : naturally.compare(path(a), path(b))))
  const counts = new Map()
  for (const layout of offered) counts.set(fold(layout.name), (counts.get(fold(layout.name)) ?? 0) + 1)
  return offered.map((layout) => ({ ...layout, label: counts.get(fold(layout.name)) > 1 ? path(layout) : layout.name }))
}

/** The axis columns: every axis name of the layouts offered, in the order first met */
export const axisColumns = (choices) => [...new Set(choices.flatMap((layout) => layout.axes))]

/** The columns that take values, in order: [{ key, label, axis? }] */
export const tableColumns = (choices) => [
  { key: 'germplasm', label: 'Germplasm' },
  ...(choices.length > 1 ? [{ key: 'layout', label: 'Layout' }] : []),
  ...axisColumns(choices).map((axis) => ({ key: `axis:${axis}`, label: axis, axis }))
]

const holds = (position, time) => {
  const from = periodStart(time)
  if (from == null) return false
  return (periodStart(position.start) ?? -Infinity) < periodEnd(time) && from < (periodEnd(position.end) ?? Infinity)
}
const startOf = (position) => periodStart(position.start) ?? -Infinity
const endOf = (position) => periodEnd(position.end) ?? Infinity

/** The unit's own position holding at a time, the later-starting where two do; or null */
export const ownPositionAt = (positions, time) => (positions ?? [])
  .filter((position) => holds(position, time))
  .sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b))
  .at(-1) ?? null

/**
 * A unit's row as the table opens: its own germplasm, and its latest own position in one of the layouts offered, so a
 * table opened again shows where the units were put
 */
export const unitRow = (unit, choices) => {
  const offered = new Map(choices.map((layout) => [String(layout.id), layout]))
  const latest = (unit.positions ?? [])
    .filter((position) => position.layout && offered.has(String(position.layout.id)))
    .sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b))
    .at(-1)
  const layout = latest ? offered.get(String(latest.layout.id)) : null
  return {
    unitId: String(unit.id),
    name: unit.name ?? `Unit ${unit.id}`,
    values: {
      germplasm: unit.germplasm?.name ?? '',
      layout: layout && choices.length > 1 ? layout.label : '',
      ...Object.fromEntries((layout?.axes ?? []).map((axis, i) => [`axis:${axis}`, latest.coordinates?.[i] ?? '']))
    }
  }
}

/** The distinct germplasm names the rows give, as typed, for germplasmEntriesNamed */
export const germplasmNames = (rows) => {
  const names = new Map()
  for (const row of rows) {
    const name = row.values.germplasm?.trim()
    if (name && !names.has(fold(name))) names.set(fold(name), name)
  }
  return [...names.values()]
}

/**
 * The entries found for names, by folded name: an entry named so wins over those with such a synonym. Names looked up
 * but found nowhere map to [], so a name not yet looked up is told apart (undefined)
 */
export const germplasmIndex = (names, entries) => {
  const index = new Map(names.map((name) => [fold(name), []]))
  for (const name of index.keys()) {
    const named = entries.filter((entry) => fold(entry.name) === name)
    index.set(name, named.length ? named : entries.filter((entry) => (entry.synonyms ?? []).some((s) => fold(s) === name)))
  }
  return index
}

const NUMERIC_AXES = ['COORDINATE', 'CARTESIAN']

/**
 * A row checked against the unit it is for: { errors: { column key: message }, pending, placement, changes }. The
 * placement is what unitsPlaceUnits takes for it, or null when nothing changes; changes says what does: { position,
 * germplasm: 'set' | 'removed' | null }. pending is true while a germplasm name is still being looked up.
 * context: { choices, germplasm (germplasmIndex), start, end }
 */
export const checkRow = (row, unit, { choices, germplasm, start, end }) => {
  const errors = {}
  let pending = false
  const values = row.values

  // the germplasm: empty removes it
  let germplasmId = null
  const typed = values.germplasm?.trim() ?? ''
  if (typed) {
    const found = germplasm.get(fold(typed))
    if (found === undefined) pending = true
    else if (found.length === 0) errors.germplasm = `No germplasm you can read is named “${typed}”`
    else if (found.length > 1) errors.germplasm = `“${typed}” is a synonym of ${found.length} entries: give the name`
    else germplasmId = String(found[0].id)
  }
  const ownGermplasm = unit.germplasm?.id != null ? String(unit.germplasm.id) : null
  const germplasmChange = pending || errors.germplasm || germplasmId === ownGermplasm
    ? null
    : germplasmId === null ? 'removed' : 'set'

  // the position: a layout and a value on each of its axes, or nothing
  const axisKeys = Object.keys(values).filter((key) => key.startsWith('axis:'))
  const given = axisKeys.filter((key) => String(values[key] ?? '').trim() !== '')
  const layoutText = choices.length > 1 ? (values.layout?.trim() ?? '') : (given.length ? choices[0]?.label ?? '' : '')
  let position = null
  if (layoutText || given.length) {
    const layout = layoutText ? choices.find((choice) => fold(choice.label) === fold(layoutText)) : null
    if (!layoutText) errors.layout = 'Choose the layout'
    else if (!layout) errors.layout = `No layout “${layoutText}” here`
    else {
      const coordinates = layout.axes.map((axis, i) => {
        const value = String(values[`axis:${axis}`] ?? '').trim()
        if (!value) errors[`axis:${axis}`] = `${axis} needed`
        else if (NUMERIC_AXES.includes(layout.type?.axes?.[i]) && !Number.isFinite(Number(value))) {
          errors[`axis:${axis}`] = `${axis} takes a number`
        }
        return value
      })
      for (const key of given) {
        if (!layout.axes.includes(key.slice(5))) errors[key] = `${layout.label} has no ${key.slice(5)}`
      }
      position = {
        locationId: String(layout.location?.id),
        layoutId: String(layout.id),
        coordinates,
        start,
        end: end || null
      }
    }
  }
  let positionChange = false
  if (position) {
    const own = start ? ownPositionAt(unit.positions, start) : null
    positionChange = !(own && String(own.layout?.id ?? '') === position.layoutId &&
      (own.coordinates ?? []).map(String).join('\u0000') === position.coordinates.join('\u0000'))
  }

  const failed = Object.keys(errors).length > 0
  const placement = failed || pending || (!positionChange && !germplasmChange)
    ? null
    : {
        unitId: row.unitId,
        ...(positionChange ? { position } : {}),
        ...(germplasmChange ? { germplasmId } : {})
      }
  return { errors, pending, placement, changes: { position: positionChange, germplasm: germplasmChange } }
}

/** For each row index, the name of an earlier row's unit placed at the same place, where there is one */
export const samePlaces = (rows, checks) => {
  const seen = new Map()
  const found = new Map()
  checks.forEach((check, i) => {
    const position = check.placement?.position
    if (!position) return
    const place = [position.layoutId, ...position.coordinates.map(fold)].join('\u0000')
    if (seen.has(place)) found.set(i, rows[seen.get(place)].name)
    else seen.set(place, i)
  })
  return found
}

/** Text pasted from a spreadsheet: its lines, each its cells, without a last empty line */
export const pastedCells = (text) => {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  if (lines.length && lines.at(-1) === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

/**
 * Rows with text pasted into them, from a cell: { rows, unmatched, overflow }. Pasted on a value cell, the lines fill
 * the rows from that row down and the cells the columns from that column on. Pasted on a unit's name, the first cell
 * of each line names the unit whose row it fills, from the first column: a line naming no unit is left out and
 * counted in unmatched (a header line, say). Lines past the last row, or cells past the last column, are dropped and
 * counted in overflow.
 */
export const pasteInto = (rows, columns, { rowIndex, columnKey }, text) => {
  const lines = pastedCells(text)
  const next = rows.map((row) => ({ ...row, values: { ...row.values } }))
  const unmatched = []
  let overflow = 0
  const fill = (row, cells, from) => {
    cells.forEach((cell, offset) => {
      const column = columns[from + offset]
      if (column) row.values[column.key] = cell.trim()
      else if (cell.trim()) overflow++
    })
  }
  if (columnKey === 'name') {
    const byName = new Map(next.map((row) => [fold(row.name), row]))
    for (const [name, ...cells] of lines) {
      const row = byName.get(fold(name))
      if (row) fill(row, cells, 0)
      else if (fold(name) || cells.some((cell) => cell.trim())) unmatched.push(name.trim())
    }
  } else {
    const from = columns.findIndex((column) => column.key === columnKey)
    if (from < 0) return { rows, unmatched, overflow }
    lines.forEach((cells, offset) => {
      const row = next[rowIndex + offset]
      if (row) fill(row, cells, from)
      else overflow++
    })
  }
  return { rows: next, unmatched, overflow }
}
