// The table of units placed at once (PlaceUnitsModal, unitsPlaceUnits): a row for each unit, with its germplasm and
// where it is in a layout, typed or pasted from a spreadsheet. The layouts offered are the chosen one and those below
// it that have axes; each axis name is one column, shared by the layouts that have it. A layout below the chosen one
// sits at a position in its parent, on the parent's axes, so a field sheet's Block, Row and Column find a plot's block
// from Block and its place in the block from Row and Column: the layout is found from the values, as a sheet gives
// them. Only where a layout can't be found so (one at no position, or with an axis named as one above it) does the
// table have a Layout column, to name it. Names are matched ignoring case and surrounding space: germplasm by name or
// synonym (germplasmEntriesNamed), a layout by its name, or by its path from the chosen layout where names repeat.
// Only what changes is sent: a unit's position when it isn't at that place at the start already, as the API leaves
// such a unit as it is, and its germplasm when it differs from its own. Imports nothing from Vue or the app, so the
// unit tests can load it.
import { periodStart, periodEnd } from '../parsers/partialDatetime.js'

export const fold = (text) => String(text ?? '').trim().toLowerCase()

const naturally = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
/** Units in the order a field sheet lists them: by name, numbers in order (HF27-2 before HF27-10), then by id */
export const byUnitName = (a, b) =>
  naturally.compare(a.name ?? '', b.name ?? '') || naturally.compare(String(a.id), String(b.id))

/**
 * The layouts a table offers, from the tree below the chosen one (layouts: the chosen one and those below it, in any
 * order, with { id, name, axes, parent, position }): those with axes, the chosen one first, each with the label it is
 * shown and matched by, its name, or its path from the chosen one where another offered layout has the same name; and
 * its address, the values on the axes above it that lead to it from the chosen one ({ 'axis:Block': '1' }), or null
 * where it can't be found so
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
  const addresses = new Map()
  const address = (layout) => {
    const key = String(layout.id)
    if (!addresses.has(key)) {
      addresses.set(key, null)
      if (isRoot(layout)) addresses.set(key, {})
      else {
        const parent = layout.parent ? byId.get(String(layout.parent.id)) : null
        const above = parent?.axes?.length && (layout.position ?? []).length === parent.axes.length ? address(parent) : null
        const names = above && [...Object.keys(above), ...parent.axes.map((axis) => `axis:${axis}`)]
        // each axis named once on the way down, so a column feeds one level
        if (above && new Set([...names, ...layout.axes.map((axis) => `axis:${axis}`)]).size === names.length + layout.axes.length) {
          addresses.set(key, { ...above, ...Object.fromEntries(parent.axes.map((axis, i) => [`axis:${axis}`, String(layout.position[i])])) })
        }
      }
    }
    return addresses.get(key)
  }
  return offered.map((layout) => ({
    ...layout,
    label: counts.get(fold(layout.name)) > 1 ? path(layout) : layout.name,
    address: address(layout)
  }))
}

/** Whether the table needs a Layout column: a layout offered that its values can't find */
export const namesLayouts = (choices) => choices.some((choice) => choice.address === null)

/** The axis columns: every axis name of the layouts offered, in the order first met */
export const axisColumns = (choices) => [...new Set(choices.flatMap((layout) => layout.axes))]

/** The columns that take values, in order: [{ key, label, axis? }] */
export const tableColumns = (choices) => [
  { key: 'germplasm', label: 'Germplasm' },
  ...(namesLayouts(choices) ? [{ key: 'layout', label: 'Layout' }] : []),
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
  // found by its address where it can be, else named
  const named = namesLayouts(choices)
  return {
    unitId: String(unit.id),
    name: unit.name ?? `Unit ${unit.id}`,
    values: {
      germplasm: unit.germplasm?.name ?? '',
      ...(named ? { layout: layout && layout.address === null ? layout.label : '' } : {}),
      ...(layout?.address ?? {}),
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

const valueOf = (values, axis) => String(values[`axis:${axis}`] ?? '').trim()

/**
 * The layout a row's values find, from the chosen one down: at each layout, its axes' values, and the layout below it
 * at that position if the row gives values for that one's axes too. { layout, missing } where the values stop short
 */
const findLayout = (values, choices) => {
  const below = new Map()
  for (const choice of choices.slice(1)) {
    if (choice.address === null) continue
    const parent = String(choice.parent.id)
    below.set(parent, [...(below.get(parent) ?? []), choice])
  }
  let layout = choices[0]
  for (;;) {
    const here = layout.axes.map((axis) => valueOf(values, axis))
    const next = (below.get(String(layout.id)) ?? []).find((child) =>
      child.position.every((value, i) => fold(value) === fold(here[i])) && child.axes.some((axis) => valueOf(values, axis)))
    if (!next) return layout
    layout = next
  }
}

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

  // the position: a layout, named or found from the values, and a value on each of its axes; or nothing
  const given = Object.keys(values).filter((key) => key.startsWith('axis:') && String(values[key] ?? '').trim() !== '')
  const layoutText = namesLayouts(choices) ? (values.layout?.trim() ?? '') : ''
  let position = null
  let layout = null
  if (layoutText) {
    layout = choices.find((choice) => fold(choice.label) === fold(layoutText))
    if (!layout) errors.layout = `No layout “${layoutText}” here`
  } else if (given.length) {
    // from the chosen layout, the only one with an empty address, when it has axes
    const root = choices[0]?.address && !Object.keys(choices[0].address).length ? choices[0] : null
    layout = root ? findLayout(values, choices) : null
    if (!layout) errors.layout = 'Choose the layout'
  }
  if (layout) {
    const coordinates = layout.axes.map((axis, i) => {
      const value = valueOf(values, axis)
      if (!value) errors[`axis:${axis}`] = `${axis} needed`
      else if (NUMERIC_AXES.includes(layout.type?.axes?.[i]) && !Number.isFinite(Number(value))) {
        errors[`axis:${axis}`] = `${axis} takes a number`
      }
      return value
    })
    // values on the axes above it are its address; others belong to no layout here
    const address = layout.address ?? {}
    const unused = given.filter((key) => !layout.axes.includes(key.slice(5)) && !(key in address && fold(address[key]) === fold(values[key])))
    const hasBelow = choices.some((choice) => choice.address !== null && String(choice.parent?.id) === String(layout.id))
    if (unused.length && !layoutText && hasBelow) {
      const key = `axis:${layout.axes[0]}`
      if (!errors[key]) errors[key] = `No layout at ${layout.axes.map((axis) => `${axis} ${valueOf(values, axis)}`).join(', ')} in ${layout.label}`
    } else {
      for (const key of unused) errors[key] = `${layout.label} has no ${key.slice(5)}`
    }
    position = {
      locationId: String(layout.location?.id),
      layoutId: String(layout.id),
      coordinates,
      start,
      end: end || null
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
  return {
    errors, pending, placement, layout: Object.keys(errors).length ? null : layout,
    changes: { position: positionChange, germplasm: germplasmChange }
  }
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
