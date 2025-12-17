
<template>
  <title>Arrangements</title>
  <div class="arrangements-management">
    <div class="arrangements-header">
      <h2>Arrangement Management</h2>
    </div>

    <!-- Two-column layout -->
    <div class="arrangements-content">
      <!-- Left column: Regions Tree -->
      <div class="regions-tree-panel">
        <div v-if="regionsLoading" class="loading">
          Loading regions...
        </div>
        <div v-else-if="regions.length === 0" class="empty-state">
          No regions found. Visit Regions Management to create one.
        </div>
        <div v-else class="regions-tree">
          <div v-for="region in regions" :key="`locationNode_${region?.id}`" class="location-item">
            <LocationNode
              :regionId="region?.id"
              :locationId="region?.id"
              :isExpandedFn="isExpanded"
              :selectedLocationId="selectedLocationId"
              :showEdit=false
              @toggle-expand="handleToggleExpanded"
              @select-location="handleSelectLocation"
            />
          </div>
        </div>
      </div>

      <!-- Right column: Layout Details Panel -->
      <div class="layout-panel">
        <div v-if="!selectedLocation" class="empty-selection">
          <p>Select a location from the tree to view its layouts</p>
        </div>
        <div v-else class="layout-panel-content">
          <h3>{{ selectedLocationId }}</h3>
          <!-- todo get location a layoutbox query to show details
          <p v-if="selectedLocation.description" class="location-description">
            {{ selectedLocation.description }}
          </p>
          -->
          <div class="arrangements-section">
            <ArrangementsBox
              :locationId="selectedLocationId"
              :layoutTypes="layoutTypes"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

import { useQuery } from '@vue/apollo-composable'

import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'

import LocationNode from '../regionManagement/LocationNode.vue'
import ArrangementsBox from './ArrangementsBox.vue'
import { useLocationTreeNavigation } from "@/composables/regionManagement/locationTreeNavigation";

const {
  selectedLocationId,
  handleToggleExpanded,
  handleSelectLocation,
  isExpanded,
  regions,
  regionsLoading
} = useLocationTreeNavigation()

// Fetch layout types from ontology
const { result: layoutTypesResult } = useQuery(
  ONTOLOGY_ENTRIES_QUERY,
  () => ({
    labels: ['LAYOUT_TYPE']
  })
)

const layoutTypes = computed(() => {
  if (!layoutTypesResult.value?.ontologyEntries?.result) {
    return []
  }
  return layoutTypesResult.value.ontologyEntries.result
})





</script>

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