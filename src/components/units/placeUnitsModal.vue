<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectUnitsQuery } from '@/composables/datasets/selectUnitsQueries'
import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useLayoutSubtree } from '@/composables/layouts/layoutSubtree'
import { useGermplasmNamed } from '@/composables/germplasm/germplasmNamed'
import { useMoveUnits } from '@/composables/units/mutatePositions'
import { useUnitChildren } from '@/composables/units/unitChildren'
import { useCachedName } from '@/composables/queryBase/cachedName'
import { today } from '@/composables/units/unitPositions'
import { periodStart } from '@/composables/parsers/partialDatetime'
import {
  byUnitName, layoutChoices, tableColumns, unitRow, germplasmNames, germplasmIndex, checkRow, samePlaces, pasteInto,
  fold
} from '@/composables/units/placementTable'

// Places many units at once, each at a position of its own in a layout, with its germplasm (unitsPlaceUnits): e.g. a
// trial's plots as they were sown, from the field sheet. The units are picked at a location, "By type…" selecting all
// of a subject, or are at first a unit's children; the layout is one there. The table has a row for each unit and a
// column for its germplasm and each axis, so Block, Row and Column place a plot in its block, and a Layout column only
// where a layout below the chosen one must be named. Typed, or pasted from a spreadsheet: on a cell, the lines fill
// the rows from there down; on a unit's name, each line's first cell names the unit it is for. Only what changes is
// saved, all or none (placementTable.js).
const props = defineProps({
  locationId: {
    type: String,
    default: null
  },
  // the unit whose children are chosen at first, e.g. the trial area selected, for its plots
  childrenOf: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'placed'])

const formData = ref({
  locationId: props.locationId,
  unitIds: [],
  layoutId: null,
  start: today(),
  end: ''
})
const saveError = ref('')
const notice = ref('')

const unitNameOf = useCachedName('Unit')
const { placeUnits, placeUnitsLoading } = useMoveUnits()
const { lookUp } = useGermplasmNamed()

const { readChildren } = useUnitChildren()
onMounted(async () => {
  if (!props.childrenOf) return
  const children = await readChildren(props.childrenOf)
  if (!formData.value.unitIds.length) formData.value = { ...formData.value, unitIds: children.map((child) => String(child.id)) }
})

const {
  location,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations,
  layout,
  arrangements,
  loadChildLayouts,
  childLayoutsLoading,
  currentChildLayouts
} = useDefinePositionQueries({ locationId: () => formData.value.locationId, layoutId: () => formData.value.layoutId })

const {
  rootNodes: unitRootNodes,
  loadChildren: loadChildUnits,
  childrenLoading: childUnitsLoading,
  currentChildren: childUnits,
  isSelectable: isSelectableUnit,
  hasChildren: unitHasChildren,
  loadTypeGroups: loadUnitTypeGroups,
  selectedUnits,
  selectedUnitsLoading
} = useSelectUnitsQuery({
  locationIds: () => (formData.value.locationId ? [formData.value.locationId] : []),
  unitIds: () => formData.value.unitIds,
  below: true
})

const { layouts, layoutsLoading, layoutsError } = useLayoutSubtree(() => formData.value.layoutId)

const choices = computed(() => layoutChoices(formData.value.layoutId, layouts.value))
const columns = computed(() => tableColumns(choices.value))
const units = computed(() => [...selectedUnits.value].sort(byUnitName))
const unitsById = computed(() => new Map(units.value.map((unit) => [String(unit.id), unit])))

// a row for each unit chosen, opened as it is; a unit's row keeps what was typed while the units chosen change, and
// the rows open again when the layouts offered do
const rows = ref([])
let rowsFor = null
watch([units, choices], () => {
  const offered = choices.value.map((choice) => choice.id).join(',')
  const typed = new Map(offered === rowsFor ? rows.value.map((row) => [row.unitId, row]) : [])
  rowsFor = offered
  rows.value = units.value.map((unit) => typed.get(String(unit.id)) ?? unitRow(unit, choices.value))
}, { immediate: true })

const startError = computed(() => (periodStart(formData.value.start) == null ? 'Give the day they were placed' : ''))

// the germplasm named, looked up as names are typed
const looked = ref([])
const entries = ref([])
const lookUpError = ref('')
let lookUpTimer = null
watch(() => germplasmNames(rows.value), (names) => {
  clearTimeout(lookUpTimer)
  const seen = new Set(looked.value.map(fold))
  const fresh = names.filter((name) => !seen.has(fold(name)))
  if (!fresh.length) return
  lookUpTimer = setTimeout(async () => {
    const { entries: found, error } = await lookUp(fresh)
    lookUpError.value = error ?? ''
    if (error) return
    entries.value = [...entries.value, ...found.filter((entry) => !entries.value.some((e) => e.id === entry.id))]
    looked.value = [...looked.value, ...fresh]
  }, 300)
}, { deep: true, immediate: true })
const index = computed(() => germplasmIndex(looked.value, entries.value))

const checks = computed(() => rows.value.map((row) => checkRow(row, unitsById.value.get(row.unitId) ?? {}, {
  choices: choices.value,
  germplasm: index.value,
  start: startError.value ? null : (formData.value.start ?? '').trim(),
  end: formData.value.end?.trim() || null
})))
const shared = computed(() => samePlaces(rows.value, checks.value))
const placements = computed(() => checks.value.map((check) => check.placement).filter(Boolean))
const summary = computed(() => {
  const count = (test) => checks.value.filter(test).length
  return {
    placed: count((check) => check.placement?.position),
    set: count((check) => check.placement && check.changes.germplasm === 'set'),
    removed: count((check) => check.placement && check.changes.germplasm === 'removed'),
    invalid: count((check) => Object.keys(check.errors).length > 0),
    pending: count((check) => check.pending)
  }
})
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// the layout a row names, for greying the axes it doesn't have
// the layout a row is placed in, for greying the axes neither it nor the way to it has
const applies = (rowIndex, column) => {
  const layout = checks.value[rowIndex].layout
  return !column.axis || !layout || layout.axes.includes(column.axis) || column.key in (layout.address ?? {})
}
const change = (check) => [
  check.changes.position ? `placed in ${check.layout?.label}` : '',
  check.changes.germplasm === 'set' ? 'germplasm set' : '',
  check.changes.germplasm === 'removed' ? 'germplasm removed' : ''
].filter(Boolean).join(', ')

// each column as wide as its longest value, within reason, so names show whole
const widths = computed(() => {
  const size = (texts, label) => Math.min(36, Math.max(5, label.length, ...texts.map((text) => String(text ?? '').length)) + 1)
  return {
    name: size(rows.value.map((row) => row.name), 'Unit'),
    ...Object.fromEntries(columns.value.map((column) => [column.key, size(rows.value.map((row) => row.values[column.key]), column.label)]))
  }
})

const inherited = (unitId) => {
  const lineages = unitsById.value.get(unitId)?.inheritedGermplasm ?? []
  const names = [...new Set(lineages.map((lineage) => lineage.germplasm?.name).filter(Boolean))]
  return names.length ? `${names.join(', ')}, from above` : ''
}

const setValue = (rowIndex, key, value) => {
  rows.value[rowIndex] = { ...rows.value[rowIndex], values: { ...rows.value[rowIndex].values, [key]: value } }
}

const onPaste = (event, rowIndex, columnKey) => {
  const text = event.clipboardData?.getData('text') ?? ''
  // a single value is typed into its cell as usual
  if (columnKey !== 'name' && !/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return
  event.preventDefault()
  const { rows: pasted, unmatched, overflow } = pasteInto(rows.value, columns.value, { rowIndex, columnKey }, text)
  rows.value = pasted
  notice.value = [
    unmatched.length ? `${plural(unmatched.length, 'line')} named no unit here: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '…' : ''}` : '',
    overflow ? `${plural(overflow, 'value')} fell outside the table` : ''
  ].filter(Boolean).join('. ')
}

// Enter moves down the column, as in a spreadsheet
const table = ref(null)
const moveDown = async (rowIndex, columnKey) => {
  await nextTick()
  table.value?.querySelector(`[data-cell="${rowIndex + 1}:${columnKey}"]`)?.focus()
}

const save = async () => {
  saveError.value = ''
  if (startError.value || summary.value.invalid || summary.value.pending) return
  if (!placements.value.length) {
    saveError.value = 'Nothing changes: every unit is placed and has its germplasm as the table gives.'
    return
  }
  const { status, errors, units: placed } = await placeUnits(placements.value)
  if (status === 'SUCCESS') {
    emit('placed', { units: placed })
    emit('close')
  } else {
    saveError.value = errors?.map((error) => error.message).join(', ') || 'The units could not be placed.'
  }
}
</script>

<template>
  <div class="modal modal-xl place-units" @click.stop>
    <div class="modal-header">
      <h4>Place units</h4>
    </div>
    <p class="place-help">
      Each unit at a place of its own in a layout, from a day, and its germplasm: e.g. a trial's plots as sown, from the
      field sheet. Paste a sheet's rows on a unit's name to fill the rows of the units its first column names, or on any
      other cell to fill the rows from there down.
    </p>
    <FormKit v-model="formData" type="form" :actions="false" @submit="save">
      <div class="place-setup">
        <FormKit
          type="hierarchical-select"
          name="locationId"
          label="At:"
          help="Where the units and the layout are"
          :selected="location"
          :rootNodes="regions"
          :loadChildrenFn="loadChildLocations"
          :childrenLoading="childLocationsLoading"
          :currentChildren="currentChildLocations"
          :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
        />
        <FormKit
          type="hierarchical-multiselect"
          name="unitIds"
          label="Units:"
          help="The units to place: &quot;By type…&quot; selects all of a subject, e.g. every plot"
          :disabled="!formData.locationId"
          :label-fn="unitNameOf"
          :rootNodes="unitRootNodes"
          :loadChildrenFn="loadChildUnits"
          :childrenLoading="childUnitsLoading"
          :currentChildren="childUnits"
          :is-selectable-fn="isSelectableUnit"
          :has-children-fn="unitHasChildren"
          :get-node-label-fn="(node) => node.name || `${node.subject?.name} ${node.id}`"
          :load-type-groups-fn="loadUnitTypeGroups"
        />
        <FormKit
          type="hierarchical-select"
          name="layoutId"
          label="Layout:"
          help="The layout they are placed in, or one above it, e.g. the trial's: its Block finds the block, then Row and Column the place in it"
          :disabled="!formData.locationId"
          :selected="layout"
          :rootNodes="arrangements"
          :loadChildrenFn="loadChildLayouts"
          :childrenLoading="childLayoutsLoading"
          :currentChildren="currentChildLayouts"
          :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
        />
        <div class="place-times">
          <FormKit
            type="text"
            name="start"
            label="From:"
            help="The day they were placed, e.g. sown: YYYY-MM-DD, or partial (YYYY-MM)"
            validation="required|partialDateTime"
          />
          <FormKit
            type="text"
            name="end"
            label="Until:"
            help="Optional: empty, they stay there"
            validation="partialDateTime"
          />
        </div>
      </div>

      <p v-if="layoutsError" class="error-message">{{ layoutsError }}</p>
      <p v-else-if="!formData.unitIds.length || !formData.layoutId" class="place-empty">
        Choose the units and the layout to see the table.
      </p>
      <p v-else-if="layoutsLoading || selectedUnitsLoading && !rows.length" class="place-empty">Loading…</p>
      <p v-else-if="!choices.length" class="error-message">This layout and those below it have no axes to place units by.</p>
      <template v-else>
        <datalist id="place-layouts">
          <option v-for="choice in choices" :key="choice.id" :value="choice.label" />
        </datalist>
        <div class="table-wrap">
          <table ref="table" class="placement-table">
            <thead>
              <tr>
                <th class="unit-column">Unit</th>
                <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
                <th class="status-column"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in rows" :key="row.unitId" :data-unit="row.unitId">
                <td class="unit-column">
                  <input
                    class="unit-name"
                    readonly
                    :value="row.name"
                    :size="widths.name"
                    title="Paste a sheet's rows here: each line's first cell names its unit"
                    :data-cell="`${rowIndex}:name`"
                    @paste="onPaste($event, rowIndex, 'name')"
                  >
                </td>
                <td v-for="column in columns" :key="column.key" :class="{ 'not-applicable': !applies(rowIndex, column) }">
                  <input
                    :value="row.values[column.key] ?? ''"
                    :size="widths[column.key]"
                    :list="column.key === 'layout' ? 'place-layouts' : undefined"
                    :placeholder="column.key === 'germplasm' ? inherited(row.unitId) : ''"
                    :class="{ invalid: checks[rowIndex].errors[column.key] }"
                    :title="checks[rowIndex].errors[column.key] ?? ''"
                    :aria-label="`${row.name}: ${column.label}`"
                    :data-cell="`${rowIndex}:${column.key}`"
                    @input="setValue(rowIndex, column.key, $event.target.value)"
                    @paste="onPaste($event, rowIndex, column.key)"
                    @keydown.enter.prevent="moveDown(rowIndex, column.key)"
                  >
                </td>
                <td class="status-column">
                  <span v-if="Object.keys(checks[rowIndex].errors).length" class="row-error">
                    {{ Object.values(checks[rowIndex].errors)[0] }}
                  </span>
                  <span v-else-if="checks[rowIndex].pending" class="row-note">Looking up…</span>
                  <span v-else-if="shared.has(rowIndex)" class="row-warning">Same place as {{ shared.get(rowIndex) }}</span>
                  <span v-else-if="checks[rowIndex].placement" class="row-change">
                    {{ change(checks[rowIndex]) }}
                  </span>
                  <span v-else class="row-note">unchanged</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="notice" class="place-notice">{{ notice }}</p>
        <p v-if="lookUpError" class="error-message">{{ lookUpError }}</p>
        <p class="place-summary">
          {{ plural(summary.placed, 'unit') }} to place<template v-if="summary.set">, {{ summary.set }} given germplasm</template><template v-if="summary.removed">, {{ summary.removed }} losing theirs</template><template v-if="summary.invalid">; {{ plural(summary.invalid, 'row') }} to correct</template>
        </p>
      </template>

      <div v-if="saveError" class="error-message">{{ saveError }}</div>
      <div class="form-actions">
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="placeUnitsLoading || !rows.length || summary.invalid > 0 || summary.pending > 0 || !!startError"
        >
          {{ placeUnitsLoading ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="placeUnitsLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
.place-help,
.place-empty {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}

.place-setup {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0 16px;
}

.place-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.table-wrap {
  max-height: 50vh;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.placement-table {
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.placement-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f5f5f5;
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid #ddd;
  white-space: nowrap;
}

.placement-table td {
  padding: 0;
  border-bottom: 1px solid #eee;
}

.placement-table input {
  box-sizing: border-box;
  border: 1px solid transparent;
  padding: 5px 8px;
  font: inherit;
  background: transparent;
}

.placement-table input:focus {
  outline: none;
  border-color: #4a90d9;
  background: white;
}

.placement-table input.invalid {
  border-color: #d9534f;
  background: #fdf2f2;
}

.placement-table .unit-name {
  font-weight: 500;
  cursor: default;
}

.placement-table td.not-applicable {
  background: #f3f3f3;
}

.status-column {
  padding: 0 8px !important;
  min-width: 14em;
  font-size: 0.8rem;
}

.row-error {
  color: #c9302c;
}

.row-warning {
  color: #b9770e;
}

.row-change {
  color: #2e7d32;
}

.row-note {
  color: #888;
}

.place-notice {
  margin: 8px 0 0;
  color: #b9770e;
  font-size: 0.85rem;
}

.place-summary {
  margin: 8px 0 12px;
  font-size: 0.9rem;
}
</style>
