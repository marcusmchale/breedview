<script setup>
import { ref } from 'vue'

import BlocksBox from './BlocksBox.vue'
import BlockTree from './BlockTree.vue'
import UnitCard from './UnitCard.vue'
import LocationTree from "@/components/regions/LocationTree.vue"

import { useBlocksBoxQueries } from '@/composables/blocks/blocksBoxQueries'

const displayedLocationId = ref(null)
const selectedBlockId = ref(null)
const selectedNodeId = ref(null)
const selectedParentId = ref(null)
const unitTreeKey = ref(0)

const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
  selectedBlockId.value = null
  selectedNodeId.value = null
}

const locationIds = ref([])
const {
  subjects
} = useBlocksBoxQueries({ locationIds })

const onBlockSelected = (blockId) => {
  selectedBlockId.value = blockId
  selectedNodeId.value = blockId
  selectedParentId.value = null
  unitTreeKey.value++
}

const onNodeSelected = ({ nodeId, parentId }) => {
  selectedNodeId.value = nodeId
  selectedParentId.value = parentId
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
  <title>Blocks</title>
  <div class="blocks-management">
    <div class="blocks-content">
      <!-- Top Row: Location Tree, Blocks Box, Unit Tree -->
      <div class="blocks-top-row">
        <div class="regions-tree-panel">
          <LocationTree @location-selected="onLocationSelected" />
        </div>

        <div class="blocks-panel">
          <div v-if="!displayedLocationId" class="empty-selection">
            <p>Select a location from the tree to view its blocks</p>
          </div>
          <div v-else>
            <BlocksBox
              :locationId="displayedLocationId"
              @block-selected="onBlockSelected"
            />
          </div>
        </div>

        <div class="tree-panel">
          <div v-if="!selectedBlockId" class="empty-selection">
            <p>Select a block to view its unit structure</p>
          </div>
          <div v-else>
            <BlockTree
              :key="unitTreeKey"
              :blockId="selectedBlockId"
              :subjects="subjects"
              @node-selected="onNodeSelected"
            />
          </div>
        </div>
      </div>

      <!-- Bottom Row: Unit Card -->
      <div v-if="selectedBlockId" class="card-panel">
        <UnitCard
          :unitId="selectedNodeId"
          :parentId="selectedParentId"
          :blockId="selectedBlockId"
          :locationId="displayedLocationId"
          :subjects="subjects"
          @refresh-tree="handleRefreshTree"
          @node-deleted="handleNodeDeleted"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.blocks-management {
  padding: 20px;
}

.blocks-content {
  display: grid;
  flex-direction: column;
  gap: 20px;
}

.blocks-top-row {
  display: grid;
  grid-template-columns: 400px 400px 1fr;
  gap: 20px;
  min-height: 600px;
}

.regions-tree-panel,
.blocks-panel,
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
</style>