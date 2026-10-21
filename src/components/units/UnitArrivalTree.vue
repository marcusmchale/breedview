<script setup>
import { computed, watch } from 'vue'

import UnitTreeNode from './UnitTreeNode.vue'

import { useArrivalUnitsQuery } from '@/composables/units/arrivalUnitsQuery'
import { useUnitQuery } from '@/composables/units/unitQuery'

// The units of an arrival, a page at a time, each with the units it came from and the tree below it
const props = defineProps({
  // { location: { id, name }, start, unitCount } as unitsArrivals lists it
  arrival: {
    type: Object,
    required: true
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

const emit = defineEmits(['node-selected', 'go-to-unit', 'clear-from', 'units-loaded'])

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
</script>

<template>
  <div class="arrival-tree">
    <div class="arrival-heading">
      <h5>{{ heading }}</h5>
      <span class="count">{{ arrival.unitCount }} unit{{ arrival.unitCount !== 1 ? 's' : '' }}</span>
      <span v-if="unitId" class="from-chip">
        from {{ fromUnit ? unitName(fromUnit) : `Unit ${unitId}` }}
        <button type="button" class="from-clear" title="Show all of the arrival" @click="emit('clear-from')">×</button>
      </span>
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
  background: #e3f2fd;
  color: #1565c0;
  font-size: 12px;
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
  color: #1565c0;
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
