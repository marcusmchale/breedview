<script setup>
import { ref } from 'vue'

import BlocksBox from './BlocksBox.vue'
import LocationTree from "@/components/regions/LocationTree.vue"

const displayedLocationId = ref(null)
const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
}
</script>

<template>
  <title>Blocks</title>
  <div class="blocks-management">
    <div class="blocks-header">
      <h2>Blocks Management</h2>
    </div>
    <div class="blocks-content">
      <div class="regions-tree-panel">
        <LocationTree
          :showEdit=false
          @location-selected="onLocationSelected"
        />
      </div>
      <div class="unit-panel">
        <div v-if="!displayedLocationId" class="empty-selection">
          <p>Select a location from the tree to view its blocks</p>
        </div>
        <div v-else class="unit-panel-content">
          <div class="blocks-section">
            <BlocksBox
              :locationId="displayedLocationId"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blocks-management {
  padding: 20px;
}

.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 16px;
}

.blocks-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
  min-height: 600px;
}

.regions-tree-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.unit-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.regions-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.location-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
  font-style: italic;
}

.unit-panel-content h3 {
  margin: 0 0 8px 0;
  font-size: 22px;
  color: #333;
}

.location-description {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
}

.blocks-section {
  margin-top: 20px;
}
</style>