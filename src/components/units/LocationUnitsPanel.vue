<script setup>
import { ref, computed, watch } from 'vue'

import UnitGraphsBox from './UnitGraphsBox.vue'
import UnitArrivalsBox from './UnitArrivalsBox.vue'
import UnitTree from './UnitTree.vue'
import UnitArrivalTree from './UnitArrivalTree.vue'
import UnitCard from './UnitCard.vue'

import { useUnitGraphsBoxQueries } from '@/composables/units/unitGraphsBoxQueries'
import { arrivalParam, pathFrom, useUnitWithAncestors } from '@/composables/units/unitPlaces'

// The units at one location: its unit graphs and arrivals, the selected one's tree, and the selected unit's card.
// What is selected is the page's, in its address: the panel asks for changes with update.
const props = defineProps({
  locationId: {
    type: String,
    required: true
  },
  // the root of the selected unit graph
  graph: {
    type: String,
    default: null
  },
  // the selected arrival's start (arrivalParam)
  arrival: {
    type: String,
    default: null
  },
  // only the arrivals of the units at, below or above this unit
  from: {
    type: String,
    default: null
  },
  // the selected unit
  unit: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update', 'go-to-unit'])

const { subjects } = useUnitGraphsBoxQueries({ locationIds: computed(() => [props.locationId]) })

const arrivals = ref([])
const selectedArrival = computed(() => arrivals.value.find((a) => arrivalParam(a.start) === props.arrival) ?? null)
const onArrivalsLoaded = (list) => {
  arrivals.value = list
  // asked where some units went: open the newest of their arrivals
  if (props.from && !props.graph && !props.arrival && list.length) {
    emit('update', { arrival: arrivalParam(list[0].start) })
  }
}

// The selected unit with the units above it: the way down to it is opened in the tree, and a unit a link led to
// is shown in its unit graph when the graph is rooted here, else in the arrival that brought it or the unit above it
const { loadUnitWithAncestors, parentsOf } = useUnitWithAncestors()
const focus = ref(null)
const rootOf = (unit) => (unit.ancestors ?? []).find((ancestor) => !ancestor.parents?.length) ?? unit
watch(() => props.unit, async (unitId) => {
  focus.value = unitId ? await loadUnitWithAncestors(unitId) : null
  if (!focus.value || props.graph || props.arrival) return
  const root = rootOf(focus.value)
  if ((root.positions ?? []).some((position) => position.location?.id === props.locationId)) {
    emit('update', { graph: root.id })
  } else if (!props.from) {
    emit('update', { from: unitId })
  }
}, { immediate: true })

const arrivalTops = ref([])
const expandIds = computed(() => {
  if (!focus.value || String(focus.value.id) !== props.unit) return new Set()
  const tops = props.graph ? [props.graph] : arrivalTops.value.map((unit) => unit.id)
  const path = pathFrom(tops, focus.value.id, parentsOf(focus.value))
  return new Set(path ? path.slice(0, -1) : [])
})
// the card's unit graph, for the parents a unit can be given
const cardBlockId = computed(() => props.graph ?? (focus.value ? String(rootOf(focus.value).id) : null))

const onBlockSelected = (blockId) => emit('update', { graph: blockId, arrival: null, from: null, unit: blockId })
const onArrivalSelected = (arrival) => emit('update', { graph: null, arrival: arrivalParam(arrival.start), unit: null })
const onNodeSelected = ({ nodeId }) => emit('update', { unit: nodeId })

const treeKey = ref(0)
const handleRefreshTree = () => {
  treeKey.value++
}
const handleNodeDeleted = () => {
  emit('update', { unit: null })
  treeKey.value++
}
</script>

<template>
  <div class="location-units-panel">
    <div class="top-row">
      <div class="box-panel">
        <UnitGraphsBox
          :locationId="locationId"
          :selectedBlockId="graph"
          @block-selected="onBlockSelected"
        />
        <UnitArrivalsBox
          :locationId="locationId"
          :unitId="from"
          :selectedArrival="arrival"
          @arrival-selected="onArrivalSelected"
          @arrivals-loaded="onArrivalsLoaded"
        />
      </div>

      <div class="tree-panel">
        <UnitTree
          v-if="graph"
          :key="`graph_${graph}_${treeKey}`"
          :blockId="graph"
          :contextLocationId="locationId"
          :selectedNodeId="unit"
          :expandIds="expandIds"
          @node-selected="onNodeSelected"
        />
        <UnitArrivalTree
          v-else-if="selectedArrival"
          :key="`arrival_${arrival}_${from}_${treeKey}`"
          :arrival="selectedArrival"
          :unitId="from"
          :selectedNodeId="unit"
          :expandIds="expandIds"
          @node-selected="onNodeSelected"
          @go-to-unit="emit('go-to-unit', $event)"
          @clear-from="emit('update', { from: null })"
          @units-loaded="arrivalTops = $event"
        />
        <div v-else class="empty-selection">
          <p>Select a unit graph or an arrival to view its units</p>
        </div>
      </div>
    </div>

    <div v-if="unit" class="card-panel">
      <UnitCard
        :unitId="unit"
        :blockId="cardBlockId"
        :locationId="locationId"
        :subjects="subjects"
        @refresh-tree="handleRefreshTree"
        @node-deleted="handleNodeDeleted"
        @go-to-unit="emit('go-to-unit', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.location-units-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);  /* as wide as the page, whatever the width of its contents */
  gap: 20px;
}

.top-row {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  min-height: 300px;
}

.box-panel,
.tree-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.box-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #999;
  font-size: 16px;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.card-panel {
  width: 100%;
}

/* too narrow for the tree beside the lists: the tree goes below them */
@media (max-width: 700px) {
  .top-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
