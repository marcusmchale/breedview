// The table of units placed at once (src/composables/units/placementTable.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  byUnitName, layoutChoices, tableColumns, unitRow, germplasmNames, germplasmIndex, checkRow, samePlaces, pasteInto,
  ownPositionAt
} from '../../src/composables/units/placementTable.js'

const FIELD = { id: '9', name: 'Hill Field' }
const indexed = { axes: ['ORDINAL', 'ORDINAL'] }
const TRIAL = { id: '1', name: 'Trial', axes: ['Block'], parent: null, location: FIELD, type: { axes: ['NOMINAL'] } }
const block = (id, name, parent = TRIAL) => ({ id, name, axes: ['Row', 'Column'], parent, location: FIELD, type: indexed })
const LAYOUTS = [block('3', 'Block 2'), block('2', 'Block 1'), TRIAL, block('4', 'Block 10')]
const choices = layoutChoices('1', LAYOUTS)
const START = '2026-10-15'

const plot = (id, name, { germplasm = null, positions = [] } = {}) => ({ id, name, germplasm, positions })
const at = (layout, coordinates, start = null, end = null) => ({ location: FIELD, layout: { id: layout }, coordinates, start, end })
const LINE = { id: '50', name: 'EPB 26-X01', synonyms: ['X01'] }
const row = (unit, values) => ({ unitId: unit.id, name: unit.name, values: { germplasm: '', layout: '', ...values } })
const context = (index = germplasmIndex([], [])) => ({ choices, germplasm: index, start: START, end: null })

test('units are listed as a field sheet lists them, numbers in order', () => {
  const names = ['HF27-10', 'HF27-2', 'hf27-1'].map((name, i) => ({ id: String(i), name }))
  assert.deepEqual(names.sort(byUnitName).map((unit) => unit.name), ['hf27-1', 'HF27-2', 'HF27-10'])
})

test('the layouts offered are the chosen one first, then those below it in order, each axis a column', () => {
  assert.deepEqual(choices.map((layout) => layout.label), ['Trial', 'Block 1', 'Block 2', 'Block 10'])
  assert.deepEqual(tableColumns(choices).map((column) => column.key),
    ['germplasm', 'layout', 'axis:Block', 'axis:Row', 'axis:Column'])
  // with one layout there is nothing to choose
  assert.deepEqual(tableColumns(layoutChoices('2', [block('2', 'Block 1')])).map((column) => column.key),
    ['germplasm', 'axis:Row', 'axis:Column'])
  // names that repeat are told apart by their paths
  const north = { ...TRIAL, id: '7', name: 'North' }
  const repeated = layoutChoices('1', [TRIAL, north, block('8', 'Block 1', north), block('2', 'Block 1')])
  assert.deepEqual(repeated.map((layout) => layout.label), ['Trial', 'Block 1', 'North', 'North / Block 1'])
})

test("a unit's row opens with its own germplasm and latest position in the layouts offered", () => {
  const unit = plot('20', 'HF27-1', { germplasm: LINE, positions: [at('2', ['1', '1'], null, START), at('3', ['2', '4'], START)] })
  assert.deepEqual(unitRow(unit, choices), {
    unitId: '20', name: 'HF27-1', values: { germplasm: 'EPB 26-X01', layout: 'Block 2', 'axis:Row': '2', 'axis:Column': '4' }
  })
  // placed only with its parent
  assert.deepEqual(unitRow(plot('21', 'HF27-2'), choices).values, { germplasm: '', layout: '' })
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
  assert.deepEqual(checkRow(row(plot('5', 'E'), { germplasm: 'Later' }), plot('5', 'E'), context(index)),
    { errors: {}, pending: true, placement: null, changes: { position: false, germplasm: null } })
})

test('a position needs a layout offered and a value on each of its axes, numbers where its axes take them', () => {
  const unit = plot('1', 'HF27-1')
  const errors = (values, opts = context()) => checkRow(row(unit, values), unit, opts).errors
  assert.deepEqual(errors({ 'axis:Row': '1' }), { layout: 'Choose the layout' })
  assert.deepEqual(errors({ layout: 'Block 9', 'axis:Row': '1' }), { layout: 'No layout “Block 9” here' })
  assert.deepEqual(errors({ layout: 'block 1', 'axis:Row': '1' }), { 'axis:Column': 'Column needed' })
  assert.deepEqual(errors({ layout: 'Block 1', 'axis:Row': '1', 'axis:Column': '2', 'axis:Block': '1' }),
    { 'axis:Block': 'Block 1 has no Block' })
  const gridded = [{ ...block('5', 'Grid'), type: { axes: ['COORDINATE', 'CARTESIAN'] } }]
  assert.deepEqual(errors({ 'axis:Row': '1.5', 'axis:Column': 'x' }, { ...context(), choices: layoutChoices('5', gridded) }),
    { 'axis:Column': 'Column takes a number' })
})

test('only what changes is sent: a unit at its place from the start already keeps it, and empty germplasm removes it', () => {
  const values = { layout: 'Block 1', 'axis:Row': '1', 'axis:Column': '2' }
  const position = { locationId: '9', layoutId: '2', coordinates: ['1', '2'], start: START, end: null }
  const unplaced = plot('1', 'HF27-1')
  assert.deepEqual(checkRow(row(unplaced, values), unplaced, context()).placement, { unitId: '1', position })
  const placed = plot('1', 'HF27-1', { germplasm: LINE, positions: [at('2', ['1', '2'], '2026-10')] })
  assert.deepEqual(checkRow(row(placed, { ...values, germplasm: 'EPB 26-X01' }), placed,
    context(germplasmIndex(['EPB 26-X01'], [LINE]))), {
    errors: {}, pending: false, placement: null, changes: { position: false, germplasm: null }
  })
  assert.deepEqual(checkRow(row(placed, values), placed, context()),
    { errors: {}, pending: false, placement: { unitId: '1', germplasmId: null }, changes: { position: false, germplasm: 'removed' } })
  // elsewhere then, or placed at the same place only before the start
  const moved = plot('1', 'HF27-1', { positions: [at('2', ['1', '2'], '2025', '2026-01')] })
  assert.deepEqual(checkRow(row(moved, values), moved, context()).placement, { unitId: '1', position })
  assert.equal(ownPositionAt(moved.positions, START), null)
})

test('two units at the same place are pointed out', () => {
  const units = [plot('1', 'HF27-1'), plot('2', 'HF27-2'), plot('3', 'HF27-3')]
  const rows = units.map((unit, i) => row(unit, { layout: 'Block 1', 'axis:Row': '1', 'axis:Column': i === 2 ? ' 1 ' : String(i + 1) }))
  const checks = rows.map((r, i) => checkRow(r, units[i], context()))
  assert.deepEqual([...samePlaces(rows, checks)], [[2, 'HF27-1']])
})

test('pasted on a value cell, lines fill rows down and cells columns across; on a name, rows are found by name', () => {
  const columns = tableColumns(choices)
  const rows = ['HF27-1', 'HF27-2', 'HF27-3'].map((name, i) => row(plot(String(i), name), {}))
  const down = pasteInto(rows, columns, { rowIndex: 1, columnKey: 'layout' }, 'Block 1\t\t1\t2\r\nBlock 2\t\t3\t4\t9\r\nBlock 1\t\t5\t6\n')
  assert.deepEqual(down.rows.map((r) => [r.values.layout, r.values['axis:Row'], r.values['axis:Column']]),
    [['', undefined, undefined], ['Block 1', '1', '2'], ['Block 2', '3', '4']])
  assert.deepEqual([down.unmatched, down.overflow], [[], 2])
  assert.equal(rows[1].values.layout, '', 'the rows given are left as they were')

  const sheet = 'Plot\tEntry\tLayout\tBlock\tRow\tColumn\nhf27-3\tEPB 26-X01\tBlock 2\t\t1\t1\nHF27-1\tX01\tBlock 1\t\t1\t2\nHF27-9\tX01\n'
  const named = pasteInto(rows, columns, { rowIndex: 0, columnKey: 'name' }, sheet)
  assert.deepEqual(named.rows.map((r) => [r.values.germplasm, r.values.layout, r.values['axis:Column']]),
    [['X01', 'Block 1', '2'], ['', '', undefined], ['EPB 26-X01', 'Block 2', '1']])
  assert.deepEqual([named.unmatched, named.overflow], [['Plot', 'HF27-9'], 0])
})
