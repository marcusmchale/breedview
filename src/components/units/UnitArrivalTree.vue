<script setup>
import { computed, ref, watch } from 'vue'

import UnitTreeNode from './UnitTreeNode.vue'
import moveUnitsModal from './moveUnitsModal.vue'
import changePositionsModal from './changePositionsModal.vue'
import deriveUnitsModal from './deriveUnitsModal.vue'
import addChildrenModal from './addChildrenModal.vue'

import { useArrivalUnitsQuery } from '@/composables/units/arrivalUnitsQuery'
import { useUnitQuery } from '@/composables/units/unitQuery'
import { useCanCreate, useCanCurateAll } from '@/composables/controls/useWriteAccess'

// The units of an arrival, a page at a time, each with the units it came from and the tree below it
const props = defineProps({
  // { location: { id, name }, start, unitCount, derivedUnitCount, pendingUnitCount } as unitsArrivals lists it
  arrival: {
    type: Object,
    required: true
  },
  // the subjects new units derived from the arrival's may be given
  subjects: {
    type: Array,
    default: () => []
  },
  // only the units at, below or above this unit
  unitId: {
    type: String,
    default: null
  },
  selectedNodeId: {
    type: String,
    default: null
  },
  expandIds: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits([
  'node-selected', 'go-to-unit', 'clear-from', 'units-loaded', 'arrival-moved', 'arrival-changed', 'arrival-derived',
  'children-added'
])

const arrivalInput = computed(() => ({
  locationId: props.arrival.location.id,
  start: props.arrival.start,
  unitId: props.unitId || null
}))

const {
  units,
  hasMore,
  unitsLoading,
  unitsError,
  loadMore
} = useArrivalUnitsQuery({ arrival: arrivalInput })

// the panel opens the way down to a unit a link led to, from the arrival's units listed
watch(units, (list) => emit('units-loaded', list))

const { unit: fromUnit } = useUnitQuery(() => props.unitId)

const unitName = (unit) => unit.name || `Unit ${unit.id}`
const heading = computed(() => props.arrival.start
  ? `Arrived at ${props.arrival.location.name} on ${props.arrival.start}`
  : `At ${props.arrival.location.name}, undated`)

// The arrival's units are moved, ended or corrected together, those of them related to the "from" unit if one is
// chosen; offered to those who curate the units listed, as the backend refuses the write unless they curate them all
const canWrite = useCanCurateAll({ entityLabel: 'UNIT', entityIds: computed(() => units.value.map((unit) => unit.id)) })
const selection = computed(() => ({ arrival: arrivalInput.value }))
const at = computed(() => ({ locationId: props.arrival.location.id, start: props.arrival.start }))
const current = computed(() => ({ location: props.arrival.location, start: props.arrival.start }))
const description = computed(() => {
  const count = props.unitId ? `the units from ${fromUnit.value ? unitName(fromUnit.value) : `Unit ${props.unitId}`}`
    : `the ${props.arrival.unitCount} unit${props.arrival.unitCount !== 1 ? 's' : ''}`
  return props.arrival.start
    ? `${count} that arrived at ${props.arrival.location.name} on ${props.arrival.start}`
    : `${count} at ${props.arrival.location.name}, undated`
})
const modal = ref(null)  // 'move', 'end', 'correct', 'derive' or 'children'
// Units derived from the arrival's, e.g. plantlets from microcuttings, or children added to them, e.g. extracts of
// samples, need only read access to them and a team to write the new units in; the arrival's units stay as they are
const canDerive = useCanCreate()
// how many of its units have units derived from them, and how many are still there with none
const settledLabel = computed(() => [
  props.arrival.derivedUnitCount ? `${props.arrival.derivedUnitCount} derived from` : null,
  `${props.arrival.pendingUnitCount} pending`
].filter(Boolean).join(' · '))
const onChanged = ({ change }) => emit('arrival-changed', { start: 'start' in change ? change.start : props.arrival.start })
</script>

<template>
  <div class="arrival-tree">
    <div class="arrival-heading">
      <h5>{{ heading }}</h5>
      <span class="count">{{ arrival.unitCount }} unit{{ arrival.unitCount !== 1 ? 's' : '' }} · {{ settledLabel }}</span>
      <span v-if="unitId" class="from-chip">
        from {{ fromUnit ? unitName(fromUnit) : `Unit ${unitId}` }}
        <button type="button" class="from-clear" title="Show all of the arrival" @click="emit('clear-from')">×</button>
      </span>
      <span v-if="canWrite || canDerive" class="arrival-actions">
        <template v-if="canDerive">
          <button type="button" class="btn btn-sm btn-secondary" @click="modal = 'derive'">Derive…</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="modal = 'children'">Add children…</button>
        </template>
        <template v-if="canWrite">
          <button type="button" class="btn btn-sm btn-secondary" @click="modal = 'move'">Move on…</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="modal = 'end'">End here…</button>
          <button type="button" class="btn btn-sm btn-secondary" @click="modal = 'correct'">Correct…</button>
        </template>
      </span>
    </div>

    <div v-if="modal === 'derive'" class="modal-overlay" @click="modal = null">
      <deriveUnitsModal
        :units="selection"
        :description="description"
        :subjects="subjects"
        :locationId="arrival.location.id"
        @derived="emit('arrival-derived', $event)"
        @close="modal = null"
      />
    </div>
    <div v-else-if="modal === 'children'" class="modal-overlay" @click="modal = null">
      <addChildrenModal
        :units="selection"
        :description="description"
        :exampleName="units[0] ? unitName(units[0]) : null"
        :subjects="subjects"
        @added="emit('children-added', $event)"
        @close="modal = null"
      />
    </div>
    <div v-else-if="modal === 'move'" class="modal-overlay" @click="modal = null">
      <moveUnitsModal
        :units="selection"
        :description="description"
        @moved="emit('arrival-moved', $event)"
        @close="modal = null"
      />
    </div>
    <div v-else-if="modal" class="modal-overlay" @click="modal = null">
      <changePositionsModal
        :units="selection"
        :description="description"
        :at="at"
        :current="current"
        :mode="modal"
        @changed="onChanged"
        @close="modal = null"
      />
    </div>

    <div v-if="unitsError" class="error">Error loading the arrival's units: {{ unitsError.message }}</div>
    <div v-for="unit in units" :key="unit.id" class="arrival-unit">
      <div v-if="unit.parents?.length" class="origin">
        from
        <template v-for="(parent, index) in unit.parents" :key="parent.id">
          <a href="#" class="origin-link" @click.prevent="emit('go-to-unit', parent.id)">{{ unitName(parent) }}</a><span
            v-if="index < unit.parents.length - 1">, </span>
        </template>
      </div>
      <UnitTreeNode
        :unitId="unit.id"
        :selectedNodeId="selectedNodeId"
        :contextLocationId="arrival.location.id"
        :expandIds="expandIds"
        @node-selected="emit('node-selected', $event)"
      />
    </div>
    <div v-if="unitsLoading" class="loading">Loading units...</div>
    <button v-else-if="hasMore" type="button" class="btn btn-sm btn-secondary show-more" @click="loadMore">
      Show more
    </button>
  </div>
</template>

<style scoped>
.arrival-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.arrival-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.arrival-heading h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.count {
  font-size: 12px;
  color: #999;
}

.from-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border-radius: 12px;
  background: var(--brand-accent-light);
  color: var(--brand-accent-darker);
  font-size: 12px;
}

.arrival-actions {
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
}

.from-clear {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.arrival-unit {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.origin {
  font-size: 11px;
  color: #666;
}

.origin-link {
  color: var(--brand-accent-darker);
}

.loading,
.error {
  padding: 8px;
  font-size: 12px;
  color: #666;
}

.error {
  color: #d32f2f;
}

.show-more {
  align-self: flex-start;
}
</style>
