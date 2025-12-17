
<template>
  <title>Blocks</title>
  <div class="blocks-management">
    <div class="blocks-header">
      <h2>Blocks Management</h2>
    </div>

    <!-- Two-column layout -->
    <div class="blocks-content">
      <!-- Left column: Regions Tree -->
      <div class="regions-tree-panel">
        <div v-if="regionsLoading" class="loading">
          Loading regions...
        </div>
        <div v-else-if="regions.length === 0" class="empty-state">
          No regions found. Visit Regions Management to create one.
        </div>
        <div v-else class="regions-tree">
          <div v-for="region in regions" :key="`locationNode_${region.id}`" class="location-item">
            <LocationNode
              :locationId="region.id"
              :isExpandedFn="isExpanded"
              :selectedLocationId="selectedLocation?.id"
              :showEdit="false"
              @toggle-expand="(loc) => toggleExpanded(loc)"
              @select-location="handleSelectLocation"
            />
          </div>
        </div>
      </div>

      <!-- Right column: Unit Details Panel -->
      <div class="unit-panel">
        <div v-if="!selectedLocation" class="empty-selection">
          <p>Select a location from the tree to view its blocks</p>
        </div>
        <div v-else class="unit-panel-content">
          <h3>{{ selectedLocation.name }}</h3>
          <p v-if="selectedLocation.description" class="location-description">
            {{ selectedLocation.description }}
          </p>

          <div class="blocks-section">
            <BlocksBox
              :location-id="selectedLocation.id"
              :subject-types="subjectTypes"
              @reload-blocks="handleReloadBlocks"
              @load-arrangements="handleLoadArrangements"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useRegionsManagementQueries} from "@/composables/regionManagement/regionsManagementQueries"

import { useQuery, useLazyQuery } from '@vue/apollo-composable'
import { sortByHierarchyBFS} from "@/composables/sortOntologyEntries";

import ARRANGEMENTS_QUERY from '@/graphql/arrangements/arrangements.graphql'
import ONTOLOGY_ENTRIES_QUERY from '../graphql/ontology/entries.graphql'
import BLOCKS_QUERY from '../graphql/blocks/blocks.graphql'

import LocationNode from './regionManagement/LocationNode.vue'
import BlocksBox from './BlocksBox.vue'

const {
  loadRegions,
  regionsLoading,
  loadLocations

} = useRegionsManagementQueries()


const locationCache = inject('locationCache')
const layoutCache = inject('layoutCache')
const unitCache = inject('unitCache')

const {
  getLocation,
  regions,
} = locationCache

const { addLayout } = layoutCache
const { addUnit } = unitCache

const expandedLocations = ref(new Set())
const selectedLocation = ref(null)
const blocksLoading = ref(false)

const blocksQueryVariables = ref({
  locationId: null
})

const arrangementsQueryVariables = ref({
  locationId: null
})


// Fetch blocks for a location
const { load: loadBlocks, onResult: onBlocksResult, refetch: refetchBlocks } = useLazyQuery(
  BLOCKS_QUERY,
  () => blocksQueryVariables.value
)

onBlocksResult((result) => {
  console.log('blocksResult:', result)
  if (result?.data?.blocks?.result) {
    const units = result.data.blocks.result
    const locationId = blocksQueryVariables.value.locationId
    if (locationId) {
      units.forEach(unit => {
        addUnit(unit, [locationId])
      })
    }
  }
  blocksLoading.value = false
})

// Fetch layouts for a location
const { load: loadArrangements, onResult: onArrangementsResult } = useLazyQuery(
  ARRANGEMENTS_QUERY,
  () => arrangementsQueryVariables.value
)

onArrangementsResult((result) => {
  if (result?.data?.arrangements?.result) {
    if (result.data.arrangements.result.length > 0) {
      result.data.arrangements.result.forEach(layout => {
        addLayout(layout, arrangementsQueryVariables.value.locationId)
      })
    }
  }
})

// Fetch subject types from ontology
const {
  result: subjectTypesResult,
} = useQuery(
  ONTOLOGY_ENTRIES_QUERY,
  () => ({
    labels: ['SUBJECT']
  })
)

// Get subject types from query result
const subjectTypes = computed(() => {
  if (!subjectTypesResult.value?.ontologyEntries?.result) {
    return []
  }
  const entries = subjectTypesResult.value.ontologyEntries.result
  return sortByHierarchyBFS(entries)
})


// Load children for a location
const loadLocationChildren = (location) => {
  if (!location.children || location.children.length === 0) {
    return
  }
  loadLocations(location.children)
}

// Load blocks for a location
const loadLocationBlocks = (locationId) => {
  blocksLoading.value = true
  blocksQueryVariables.value = { locationId }
  loadBlocks()
}

// Load blocks for a location
const reloadLocationBlocks = (locationId) => {
  blocksLoading.value = true
  blocksQueryVariables.value = { locationId }
  refetchBlocks()
}


// Load arrangements for a location
const loadLocationArrangements = (locationId) => {
  arrangementsQueryVariables.value = { locationId }
  loadArrangements()
}

// Toggle expansion
const toggleExpanded = (location) => {
  if (expandedLocations.value.has(location.id)) {
    expandedLocations.value.delete(location.id)
  } else {
    expandedLocations.value.add(location.id)
    if (location.children?.length > 0) {
      loadLocationChildren(location)
    }
    handleSelectLocation(location)
  }
}

// Check if location is expanded
const isExpanded = (locationId) => {
  return expandedLocations.value.has(locationId)
}

// Handle location selection from tree
const handleSelectLocation = (location) => {
  selectedLocation.value = getLocation(location.id)
  loadLocationBlocks(location.id)
  loadLocationArrangements(location.id)
}

// Handle reload blocks after changes
const handleReloadBlocks = (locationId) => {
  blocksLoading.value = true
  reloadLocationBlocks(locationId)
}

// Handle load arrangements for blocks box to allow describing a new position
const handleLoadArrangements = (locationId) => {
  loadLocationArrangements(locationId)
}


onMounted(() => {
  loadRegions()
})


</script>

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