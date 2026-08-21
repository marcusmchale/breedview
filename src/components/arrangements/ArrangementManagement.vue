<script setup>
import { ref } from 'vue'

import ArrangementsBox from './ArrangementsBox.vue'
import ArrangementTree from './ArrangementTree.vue'
import LayoutCard from './LayoutCard.vue'
import LocationTree from "@/components/regions/LocationTree.vue"

const displayedLocationId = ref(null)
const selectedArrangementId = ref(null)
const selectedNodeId = ref(null)
const selectedParentId = ref(null)
const layoutTypes = ref([])
const arrangementTreeKey = ref(0)

const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
  selectedArrangementId.value = null
  selectedNodeId.value = null
}

const onArrangementSelected = (arrangementId, types) => {
  selectedArrangementId.value = arrangementId
  selectedNodeId.value = arrangementId
  layoutTypes.value = types
  arrangementTreeKey.value++
}

const onNodeSelected = ({ nodeId, parentId }) => {
  selectedNodeId.value = nodeId
  selectedParentId.value = parentId
}

const handleRefreshTree = () => {
  arrangementTreeKey.value++
}

const handleNodeDeleted = () => {
  selectedNodeId.value = null
  arrangementTreeKey.value++
}
</script>

<template>
  <title>Arrangements</title>
  <div class="arrangements-management">
    <div class="arrangements-content">
      <!-- Top Row: Location Tree, Arrangements Box, Arrangement Tree -->
      <div class="arrangements-top-row">
        <div class="regions-tree-panel">
          <LocationTree @location-selected="onLocationSelected" />
        </div>

        <div class="arrangements-panel">
          <div v-if="!displayedLocationId" class="empty-selection">
            <p>Select a location from the tree to view its arrangements</p>
          </div>
          <div v-else>
            <ArrangementsBox
              :locationId="displayedLocationId"
              @arrangement-selected="onArrangementSelected"
            />
          </div>
        </div>

        <div class="tree-panel">
          <div v-if="!selectedArrangementId" class="empty-selection">
            <p>Select an arrangement to view its structure</p>
          </div>
          <div v-else>
            <ArrangementTree
              :key="arrangementTreeKey"
              :arrangementId="selectedArrangementId"
              :layoutTypes="layoutTypes"
              @node-selected="onNodeSelected"
            />
          </div>
        </div>
      </div>

      <!-- Bottom Row: Arrangement Card -->
      <div v-if="selectedArrangementId" class="card-panel">
        <LayoutCard
          :layoutId="selectedNodeId"
          :parentId="selectedParentId"
          :arrangementId="selectedArrangementId"
          :layoutTypes="layoutTypes"
          @refresh-tree="handleRefreshTree"
          @node-deleted="handleNodeDeleted"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.arrangements-management {
  padding: 20px;
}

.arrangements-content {
  display: grid;
  flex-direction: column;
  gap: 20px;
}

.arrangements-top-row {
  display: grid;
  grid-template-columns: 400px 400px 1fr;
  gap: 20px;
  min-height: 600px;
}

.regions-tree-panel,
.arrangements-panel,
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