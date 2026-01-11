<script setup>
import { ref } from 'vue'

import ArrangementsBox from './ArrangementsBox.vue'
import LocationTree from "@/components/regions/LocationTree.vue"

const displayedLocationId = ref(null)
const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
}
</script>

<template>
  <title>Arrangements</title>
  <div class="arrangements-management">
    <div class="arrangements-header">
      <h2>Arrangement Management</h2>
    </div>
    <div class="arrangements-content">
      <div class="regions-tree-panel">
        <LocationTree
          :showEdit=false
          @location-selected="onLocationSelected"
        />
      </div>
      <div class="layout-panel">
        <div v-if="!displayedLocationId" class="empty-selection">
          <p>Select a location from the tree to view its layouts</p>
        </div>
        <div v-else class="layout-panel-content">
          <div class="arrangements-section">
            <ArrangementsBox
              :locationId="displayedLocationId"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arrangements-management {
  padding: 20px;
}

.arrangements-header {
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

.arrangements-content {
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

.layout-panel {
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

.layout-panel-content h3 {
  margin: 0 0 8px 0;
  font-size: 22px;
  color: #333;
}

.location-description {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
}

.arrangements-section {
  margin-top: 20px;
}
</style>