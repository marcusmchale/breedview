<template>
  <div class="regions-management">
    <title>Regions</title>

    <div class="regions-header">
      <h2>Regions Management</h2>
      <button @click="openModal" class="btn btn-primary">
        Register New Region
      </button>
    </div>

    <!-- Two-column layout -->
    <div class="regions-content">
      <!-- Left column: Regions Tree -->
      <div class="regions-tree-panel">
        <div v-if="regionsLoading" class="loading">
          Loading regions...
        </div>
        <div v-else-if="regions.length === 0" class="empty-state">
          No regions found. Create a new one to get started.
        </div>
        <div v-else class="regions-tree">
          <div v-for="region in regions" :key="region.id" class="location-item">
            <LocationNode
              :locationId="region.id"
              :expanded="isExpanded(region)"
              :location-cache="locationCache"
              :is-expanded-fn="(loc) => isExpanded(loc)"
              :region-id="region.id"
              :location-types="locationTypes"
              :selected-location-id="selectedLocation?.id"
              @toggle-expand="(loc) => toggleExpanded(loc, region.id)"
              @delete-location="handleDeleteLocation"
              @reload-location="handleReloadLocation"
              @select-location="handleSelectLocation"
            />
          </div>
        </div>
      </div>
      <!-- Right column: Map -->
      <div class="map-panel">
        <LocationMap
          :selected-location="selectedLocation"
          :child-locations="childLocations"
          @update-coordinates="handleUpdateCoordinates"
        />
      </div>
    </div>

    <!-- Register Region Modal -->
    <div v-if="isModalOpen" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Register New Region</h3>
          <button @click="closeModal" class="modal-close" :disabled="submitLoading">&times;</button>
        </div>

        <form @submit.prevent="submitRegion" class="modal-content">
          <div class="form-group">
            <label for="region-country">Country:</label>
            <select
              id="region-country"
              v-model="selectedCountry"
              required
              :disabled="countriesLoading || submitLoading"
              class="form-control"
            >
              <option :value="null" disabled>Select a country...</option>
              <option v-for="country in countries" :key="country.id" :value="country">
                {{ country.name }}
              </option>
            </select>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="submitLoading">
              {{ submitLoading ? 'Creating...' : 'Create Region' }}
            </button>
            <button type="button" @click="closeModal" class="btn btn-secondary" :disabled="submitLoading">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>

import { ref, computed, watch } from 'vue'
import { useQuery, useMutation, useLazyQuery } from '@vue/apollo-composable'
import { useLocationCache } from '../composables/useLocationCache'

import REGIONS_QUERY from '../graphql/regions/regions.graphql'
import LOCATIONS_QUERY from '../graphql/regions/locations.graphql'
import CREATE_LOCATION_MUTATION from '../graphql/regions/createLocation.graphql'
import UPDATE_LOCATION_MUTATION from '../graphql/regions/updateLocation.graphql'
import COUNTRIES_QUERY from '../graphql/regions/countries.graphql'
import ONTOLOGY_ENTRIES_QUERY from '../graphql/ontology/entries.graphql'
import LocationNode from './LocationNode.vue'
import LocationMap from './LocationMap.vue'

// Initialize the cache
const locationCache = useLocationCache()
const { addLocation, addLocations, getRegions, getLocation, getLocationRegionId, removeLocation } = locationCache

const selectedCountry = ref(null)
const isModalOpen = ref(false)
const errorMessage = ref('')
const expandedLocations = ref(new Set())

// Store variables for lazy query
const locationQueryVariables = ref({
  locationIds: []
})

const currentQueryRegionId = ref(null)

// Fetch countries, these are unregistered Locations that describe the details for countries
const {
  result: countriesResult,
  //loading: countriesLoading
} = useQuery(COUNTRIES_QUERY)

// Get countries from query result
const countries = computed(() => {
  if (!countriesResult.value?.regionsCountries?.result) {
    return []
  }
  const result = countriesResult.value.regionsCountries.result
  return result.sort((a, b) => a.name.localeCompare(b.name))
})

// Fetch regions
const { result: regionsResult, loading: regionsLoading, refetch: refetchRegions } = useQuery(REGIONS_QUERY)

// Initialize regions in cache on page load
watch(() => regionsResult.value?.regions?.result, (regionsList) => {
  if (regionsList) {
    regionsList.forEach(region => addLocation(region, region.id))
  }
}, { immediate: true })

// Use cache as source of truth for regions
const regions = computed(() => {
  return getRegions()
})

// Fetch locations by IDs
const { load: loadLocationsByIds, refetch: refetchLocationsByIds, onResult: onLocationsResult } = useLazyQuery(
  LOCATIONS_QUERY,
  () => locationQueryVariables.value
)

onLocationsResult((result) => {
  console.log('fetched new location data')
  if (result?.data?.regionsLocations?.result) {
    const locations = result.data.regionsLocations.result
    const regionId = currentQueryRegionId.value
    if (regionId) {
      console.log('loading locations for region:', regionId)
      console.log('locating locations: ', locations)
      addLocations(locations, regionId)
      // Reload children for any expanded locations
      locations.forEach(location => {
        if (expandedLocations.value.has(location.id) && location.children?.length > 0) {
          const cachedLocation = locationCache.getLocation(location.id)
          loadLocationChildren(cachedLocation, regionId)
        }
      })
    }
  }
})


// Fetch location types from ontology
const {
  result: locationTypesResult,
  //loading: locationTypesLoading
} = useQuery(
  ONTOLOGY_ENTRIES_QUERY,
  () => ({
    labels: ['LOCATION_TYPE']
  })
)


// Get location types from query result
const locationTypes = computed(() => {
  if (!locationTypesResult.value?.ontologyEntries?.result) {
    return []
  }
  const entries = locationTypesResult.value.ontologyEntries.result
  return sortByHierarchyBFS(entries)
})

// Sort ontology entries by hierarchy using Breadth-First Search
const sortByHierarchyBFS = (entries) => {
  // Create a map for quick lookup
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // Find root entries (entries with no parents)
  const roots = entries.filter(entry => !entry.parents || entry.parents.length === 0)

  // If no roots found, return original list
  if (roots.length === 0) {
    return entries
  }

  const sorted = []
  const visited = new Set()
  const queue = []

  // Initialize queue with root entries
  roots.forEach(root => {
    queue.push({ entry: root, depth: 0 })
    visited.add(root.id)
  })

  // BFS traversal
  while (queue.length > 0) {
    const { entry, depth } = queue.shift()

    // Add entry to sorted list with depth information
    sorted.push({
      ...entry,
      _depth: depth
    })

    // Add children to queue
    if (entry.children && entry.children.length > 0) {
      entry.children.forEach(childRef => {
        const child = entryMap.get(childRef.id)
        // Only add if not visited - this handles merged branches
        if (child && !visited.has(child.id)) {
          visited.add(child.id)
          queue.push({ entry: child, depth: depth + 1 })
        }
      })
    }
  }

  // Add any orphaned entries (not reachable from roots)
  entries.forEach(entry => {
    if (!visited.has(entry.id)) {
      sorted.push({ ...entry, _depth: 0 })
    }
  })

  return sorted
}

// Create location mutation
const { mutate: createLocation, loading: submitLoading, onDone: onCreateDone } = useMutation(CREATE_LOCATION_MUTATION)

// Update location mutation
const { mutate: updateLocation } = useMutation(UPDATE_LOCATION_MUTATION)

const submitRegion = async () => {
    if (!selectedCountry.value) {
    errorMessage.value = 'Please select a country'
    return
  }

  errorMessage.value = ''

  try {
    await createLocation({
      location: {
        name: selectedCountry.value.name,
        code: selectedCountry.value.code,
        typeId: selectedCountry.value.type.id
      }
    })
    // The onCreateDone callback will handle the success case
  } catch (error) {
    console.error('Submit failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

onCreateDone((result) => {
  const response = result.data?.regionsCreateLocation
  if (response?.status === 'SUCCESS') {
    resetForm()
    isModalOpen.value = false
    refetchRegions()
  } else {
    const errorMsg = response?.errors?.[0]?.message || 'Failed to create region'
    errorMessage.value = errorMsg
  }
})

// Load children for a location
const loadLocationChildren = async (location, regionId) => {
  if (!location.children || location.children.length === 0) {
    return
  }

  locationQueryVariables.value = { locationIds: location.children }
  currentQueryRegionId.value = regionId

  await loadLocationsByIds()
}

// Toggle expansion
const toggleExpanded = async (location, regionId) => {
  if (expandedLocations.value.has(location.id)) {
    expandedLocations.value.delete(location.id)
  } else {
    expandedLocations.value.add(location.id)
    if (location.children?.length > 0) {
      await loadLocationChildren(location, regionId)
    }
    handleSelectLocation(location)
  }
}

// Check if location is expanded
const isExpanded = (location) => {
  return expandedLocations.value.has(location.id)
}

const openModal = () => {
  resetForm()
  isModalOpen.value = true
}

const closeModal = () => {
  if (!submitLoading.value) {
    isModalOpen.value = false
    resetForm()
  }
}

const resetForm = () => {
  selectedCountry.value = null
  errorMessage.value = ''
}


// Handle refetch after location changes
const handleReloadLocation = async (reloadData) => {
  const { ids, regionId } = reloadData
  locationQueryVariables.value = {
    locationIds: ids
  }
  console.log('run query to reload location', locationQueryVariables)
  console.log('query for region', regionId)

  currentQueryRegionId.value = regionId
  await refetchLocationsByIds()
}

const handleDeleteLocation = async (deletedLocation) => {
  await removeLocation(deletedLocation.id)
}

// Add state for Map, selected location
const selectedLocation = ref(null)

// Computed property for child locations with coordinates
const childLocations = computed(() => {
  if (!selectedLocation.value) return []

  const children = locationCache.getChildren(selectedLocation.value)
  return children.filter(child => child.coordinates)
})

// Handle location selection from tree
const handleSelectLocation = (location) => {
  selectedLocation.value = getLocation(location.id)
  console.log('selected location:', selectedLocation)
}


// Handle coordinate updates from map
const handleUpdateCoordinates = async ({ locationId, coordinates }) => {

  try {
    const result = await updateLocation({
      location: {
        locationId: locationId,
        coordinates: coordinates
      }
    })

    if (result?.data?.regionsUpdateLocation?.status === 'SUCCESS') {
      console.log('updated coordinates for:', locationId)
      // Optionally reload the location to reflect changes
      const location = getLocation(locationId)
      if (location) {
        console.log('reloading Location:', locationId)
        await handleReloadLocation({ ids: [locationId], regionId: getLocationRegionId(locationId)})
      }
    } else {
      const errorMsg = result?.data?.regionsUpdateLocation?.errors?.[0]?.message
      console.error('Failed to update coordinates:', errorMsg || 'Unknown error')
    }
  } catch (error) {
    console.error('Error updating coordinates:', error)
  }
}
</script>

<style scoped>
.regions-management {
  padding: 20px;
}

.regions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.regions-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 16px;
}


.regions-content {
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

.map-panel {
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


/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
}

.modal-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.form-control:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.help-text {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>