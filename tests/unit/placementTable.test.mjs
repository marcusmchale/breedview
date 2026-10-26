// The table of units placed at once (src/composables/units/placementTable.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  byUnitName, layoutChoices, tableColumns, unitRow, germplasmNames, germplasmIndex, checkRow, samePlaces, pasteInto,
  ownPositionAt
} from '../../src/composables/units/placementTable.js'

// a trial laid out in blocks, each block at its number on the trial's Block axis, with rows and columns of its own
const FIELD = { id: '9', name: 'Hill Field' }
const indexed = { axes: ['ORDINAL', 'ORDINAL'] }
const TRIAL = { id: '1', name: 'Trial', axes: ['Block'], parent: null, position: null, location: FIELD, type: { axes: ['NOMINAL'] } }
const block = (id, n, parent = TRIAL, name = `Block ${n}`) =>
  ({ id, name, axes: ['Row', 'Column'], parent, position: n == null ? null : [String(n)], location: FIELD, type: indexed })
const LAYOUTS = [block('3', 2), block('2', 1), TRIAL, block('4', 10)]
const choices = layoutChoices('1', LAYOUTS)
const START = '2026-10-15'

const plot = (id, name, { germplasm = null, positions = [] } = {}) => ({ id, name, germplasm, positions })
const at = (layout, coordinates, start = null, end = null) => ({ location: FIELD, layout: { id: layout }, coordinates, start, end })
const LINE = { id: '50', name: 'EPB 26-X01', synonyms: ['X01'] }
const row = (unit, values) => ({ unitId: unit.id, name: unit.name, values: { germplasm: '', ...values } })
const context = (index = germplasmIndex([], []), offered = choices) => ({ choices: offered, germplasm: index, start: START, end: null })
const inBlock = (n, r, c) => ({ 'axis:Block': String(n), 'axis:Row': String(r), 'axis:Column': String(c) })

test('units are listed as a field sheet lists them, numbers in order', () => {
  const names = ['HF27-10', 'HF27-2', 'hf27-1'].map((name, i) => ({ id: String(i), name }))
  assert.deepEqual(names.sort(byUnitName).map((unit) => unit.name), ['hf27-1', 'HF27-2', 'HF27-10'])
})

test('the layouts offered are the chosen one first, then those below it, each found by the values above it', () => {
  assert.deepEqual(choices.map((layout) => [layout.label, layout.address]), [
    ['Trial', {}], ['Block 1', { 'axis:Block': '1' }], ['Block 2', { 'axis:Block': '2' }], ['Block 10', { 'axis:Block': '10' }]
  ])
  // each found by its values, there is no layout to name
  assert.deepEqual(tableColumns(choices).map((column) => column.key), ['germplasm', 'axis:Block', 'axis:Row', 'axis:Column'])
  // a block at no position is named, as is one whose axis is named as one above it
  const unplaced = layoutChoices('1', [TRIAL, block('2', 1), block('5', null, TRIAL, 'Spare')])
  assert.deepEqual(unplaced.map((layout) => layout.address), [{}, { 'axis:Block': '1' }, null])
  assert.deepEqual(tableColumns(unplaced).map((column) => column.key), ['germplasm', 'layout', 'axis:Block', 'axis:Row', 'axis:Column'])
  const repeating = layoutChoices('1', [TRIAL, { ...block('6', 1), axes: ['Block', 'Plot'] }])
  assert.equal(repeating[1].address, null)
  // names that repeat are told apart by their paths
  const north = { ...TRIAL, id: '7', name: 'North', parent: TRIAL, position: ['N'] }
  const repeated = layoutChoices('1', [TRIAL, north, block('8', 1, north), block('2', 1)])
  assert.deepEqual(repeated.map((layout) => layout.label), ['Trial', 'Block 1', 'North', 'North / Block 1'])
})

test("a unit's row opens with its own germplasm and latest position in the layouts offered, as a sheet gives it", () => {
  const unit = plot('20', 'HF27-1', { germplasm: LINE, positions: [at('2', ['1', '1'], null, START), at('3', ['2', '4'], START)] })
  assert.deepEqual(unitRow(unit, choices), { unitId: '20', name: 'HF27-1', values: { germplasm: 'EPB 26-X01', ...inBlock(2, 2, 4) } })
  // placed only with its parent
  assert.deepEqual(unitRow(plot('21', 'HF27-2'), choices).values, { germplasm: '' })
  // in a layout that is named
  const named = layoutChoices('1', [TRIAL, block('5', null, TRIAL, 'Spare')])
  assert.deepEqual(unitRow(plot('22', 'HF27-3', { positions: [at('5', ['3', '1'])] }), named).values,
    { germplasm: '', layout: 'Spare', 'axis:Row': '3', 'axis:Column': '1' })
})

test('germplasm is matched by name before synonym, and an unknown or shared synonym is an error', () => {
  const other = { id: '51', name: 'Other', synonyms: ['X01', 'shared'] }
  const third = { id: '52', name: 'Third', synonyms: ['SHARED'] }
  const rows = [row(plot('1', 'A'), { germplasm: ' epb 26-x01 ' }), row(plot('2', 'B'), { germplasm: 'EPB 26-X01' }),
    row(plot('3', 'C'), { germplasm: 'shared' }), row(plot('4', 'D'), { germplasm: 'nothing' })]
  const names = germplasmNames(rows)
  assert.deepEqual(names, ['epb 26-x01', 'shared', 'nothing'])
  const index = germplasmIndex([...names, 'X01'], [LINE, other, third])
  assert.deepEqual(index.get('x01').map((entry) => entry.id), ['50', '51'])
  assert.deepEqual(index.get('epb 26-x01').map((entry) => entry.id), ['50'])
  const check = (r) => checkRow(r, plot(r.unitId, r.name), context(index))
  assert.deepEqual(check(rows[0]).placement, { unitId: '1', germplasmId: '50' })
  assert.match(check(rows[2]).errors.germplasm, /synonym of 2 entries/)
  assert.match(check(rows[3]).errors.germplasm, /No germplasm you can read is named “nothing”/)
  // while it is looked up, nothing is sent
  const pending = checkRow(row(plot('5', 'E'), { germplasm: 'Later' }), plot('5', 'E'), context(index))
  assert.deepEqual([pending.pending, pending.placement], [true, null])
})

test('the layout is found from the values: a block by its number, then the place in it', () => {
  const unit = plot('1', 'HF27-1')
  const check = (values, opts = context()) => checkRow(row(unit, values), unit, opts)
  assert.deepEqual(check(inBlock(2, 1, 3)).placement.position, { locationId: '9', layoutId: '3', coordinates: ['1', '3'], start: START, end: null })
  assert.equal(check(inBlock(2, 1, 3)).layout.label, 'Block 2')
  // a block as a whole, in the trial
  assert.deepEqual(check({ 'axis:Block': '1' }).placement.position.layoutId, '1')
  assert.deepEqual(check({ 'axis:Row': '1' }).errors, { 'axis:Block': 'Block needed' })
  assert.deepEqual(check(inBlock(9, 1, 2)).errors, { 'axis:Block': 'No layout at Block 9 in Trial' })
  assert.deepEqual(check({ 'axis:Block': '1', 'axis:Row': '1' }).errors, { 'axis:Column': 'Column needed' })
  const gridded = [{ ...block('5', null), parent: null, type: { axes: ['COORDINATE', 'CARTESIAN'] } }]
  assert.deepEqual(check({ 'axis:Row': '1.5', 'axis:Column': 'x' }, context(undefined, layoutChoices('5', gridded))).errors,
    { 'axis:Column': 'Column takes a number' })
})

test('a layout that must be named is, and its address may be given beside it', () => {
  const offered = layoutChoices('1', [TRIAL, block('2', 1), block('5', null, TRIAL, 'Spare')])
  const unit = plot('1', 'HF27-1')
  const check = (values) => checkRow(row(unit, values), unit, context(undefined, offered))
  assert.equal(check({ layout: 'spare', 'axis:Row': '1', 'axis:Column': '2' }).placement.position.layoutId, '5')
  assert.equal(check({ layout: 'Block 1', ...inBlock(1, 1, 2) }).placement.position.layoutId, '2')
  assert.deepEqual(check({ layout: 'Block 1', ...inBlock(2, 1, 2) }).errors, { 'axis:Block': 'Block 1 has no Block' })
  assert.deepEqual(check({ layout: 'Block 9', 'axis:Row': '1' }).errors, { layout: 'No layout “Block 9” here' })
  // without a name, found from the values as before
  assert.equal(check(inBlock(1, 1, 2)).placement.position.layoutId, '2')
})

test('only what changes is sent: a unit at its place from the start already keeps it, and empty germplasm removes it', () => {
  const values = inBlock(1, 1, 2)
  const position = { locationId: '9', layoutId: '2', coordinates: ['1', '2'], start: START, end: null }
  const unplaced = plot('1', 'HF27-1')
  assert.deepEqual(checkRow(row(unplaced, values), unplaced, context()).placement, { unitId: '1', position })
  const placed = plot('1', 'HF27-1', { germplasm: LINE, positions: [at('2', ['1', '2'], '2026-10')] })
  const kept = checkRow(row(placed, { ...values, germplasm: 'EPB 26-X01' }), placed, context(germplasmIndex(['EPB 26-X01'], [LINE])))
  assert.deepEqual([kept.placement, kept.changes], [null, { position: false, germplasm: null }])
  const removed = checkRow(row(placed, values), placed, context())
  assert.deepEqual([removed.placement, removed.changes], [{ unitId: '1', germplasmId: null }, { position: false, germplasm: 'removed' }])
  // elsewhere then, or placed at the same place only before the start
  const moved = plot('1', 'HF27-1', { positions: [at('2', ['1', '2'], '2025', '2026-01')] })
  assert.deepEqual(checkRow(row(moved, values), moved, context()).placement, { unitId: '1', position })
  assert.equal(ownPositionAt(moved.positions, START), null)
})

test('two units at the same place are pointed out', () => {
  const units = [plot('1', 'HF27-1'), plot('2', 'HF27-2'), plot('3', 'HF27-3')]
  const rows = units.map((unit, i) => row(unit, { ...inBlock(1, 1, i + 1), ...(i === 2 ? { 'axis:Column': ' 1 ' } : {}) }))
  const checks = rows.map((r, i) => checkRow(r, units[i], context()))
  assert.deepEqual([...samePlaces(rows, checks)], [[2, 'HF27-1']])
})

test('pasted on a value cell, lines fill rows down and cells columns across; on a name, rows are found by name', () => {
  const columns = tableColumns(choices)
  const rows = ['HF27-1', 'HF27-2', 'HF27-3'].map((name, i) => row(plot(String(i), name), {}))
  const down = pasteInto(rows, columns, { rowIndex: 1, columnKey: 'axis:Block' }, '1\t1\t2\r\n2\t3\t4\t9\r\n1\t5\t6\n')
  assert.deepEqual(down.rows.map((r) => [r.values['axis:Block'], r.values['axis:Row'], r.values['axis:Column']]),
    [[undefined, undefined, undefined], ['1', '1', '2'], ['2', '3', '4']])
  assert.deepEqual([down.unmatched, down.overflow], [[], 2])
  assert.equal(rows[1].values['axis:Block'], undefined, 'the rows given are left as they were')

  const sheet = 'Plot\tEntry\tBlock\tRow\tColumn\nhf27-3\tEPB 26-X01\t2\t1\t1\nHF27-1\tX01\t1\t1\t2\nHF27-9\tX01\n'
  const named = pasteInto(rows, columns, { rowIndex: 0, columnKey: 'name' }, sheet)
  assert.deepEqual(named.rows.map((r) => [r.values.germplasm, r.values['axis:Block'], r.values['axis:Column']]),
    [['X01', '1', '2'], ['', undefined, undefined], ['EPB 26-X01', '2', '1']])
  assert.deepEqual([named.unmatched, named.overflow], [['Plot', 'HF27-9'], 0])
})
