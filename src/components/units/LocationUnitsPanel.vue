<script setup>
import { ref, computed, watch } from 'vue'

import UnitGraphsBox from './UnitGraphsBox.vue'
import UnitTree from './UnitTree.vue'
import UnitCard from './UnitCard.vue'

import { useUnitGraphsBoxQueries } from '@/composables/units/unitGraphsBoxQueries'

// The units at one location: its unit graphs, the selected graph's tree, and the selected unit's card
const props = defineProps({
  locationId: {
    type: [String, Number],
    required: true
  }
})

const selectedBlockId = ref(null)
const selectedNodeId = ref(null)
const unitTreeKey = ref(0)

watch(() => props.locationId, () => {
  selectedBlockId.value = null
  selectedNodeId.value = null
})

const { subjects } = useUnitGraphsBoxQueries({ locationIds: computed(() => [props.locationId]) })

const onBlockSelected = (blockId) => {
  selectedBlockId.value = blockId
  selectedNodeId.value = blockId
  unitTreeKey.value++
}

const onNodeSelected = ({ nodeId }) => {
  selectedNodeId.value = nodeId
}

const handleRefreshTree = () => {
  unitTreeKey.value++
}

const handleNodeDeleted = () => {
  selectedNodeId.value = null
  unitTreeKey.value++
}
</script>

<template>
  <div class="location-units-panel">
    <div class="top-row">
      <div class="box-panel">
        <UnitGraphsBox
          :locationId="locationId"
          @block-selected="onBlockSelected"
        />
      </div>

      <div class="tree-panel">
        <div v-if="!selectedBlockId" class="empty-selection">
          <p>Select a unit graph to view its units</p>
        </div>
        <UnitTree
          v-else
          :key="unitTreeKey"
          :blockId="selectedBlockId"
          @node-selected="onNodeSelected"
        />
      </div>
    </div>

    <div v-if="selectedBlockId" class="card-panel">
      <UnitCard
        :unitId="selectedNodeId"
        :blockId="selectedBlockId"
        :locationId="locationId"
        :subjects="subjects"
        @refresh-tree="handleRefreshTree"
        @node-deleted="handleNodeDeleted"
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

/* too narrow for the tree beside the list: the tree goes below it */
@media (max-width: 700px) {
  .top-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
