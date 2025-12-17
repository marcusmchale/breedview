<template>
  <title>Regions</title>
  <div class="regions-management">
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
          <div v-for="region in regions" :key="`locationNode_${region?.id}`" class="location-item">
            <LocationNode
              :regionId="region?.id"
              :locationId="region?.id"
              :isExpandedFn="isExpanded"
              :locationTypes="locationTypes"
              :selectedLocationId="selectedLocationId"
              :showEdit=true
              @toggle-expand="handleToggleExpanded"
              @select-location="handleSelectLocation"
            />
          </div>
        </div>
      </div>
      <!-- Right column: Map -->
      <div class="map-panel">
        <LocationMap
          :selectedLocationId="selectedLocationId"
          :updateCoodinatesLoading="updateCoordinatesLoading"
          :updateCoordinatesError="updateCoordinatesError"
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
              :disabled="countriesLoading || createLocationLoading"
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
            <button type="submit" class="btn btn-primary" :disabled="createLocationLoading">
              {{ createLocationLoading ? 'Creating...' : 'Create Region' }}
            </button>
            <button type="button" @click="closeModal" class="btn btn-secondary" :disabled="createLocationLoading">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import {
  useQuery
} from '@vue/apollo-composable'

import { sortByHierarchyBFS} from "@/composables/sortOntologyEntries";
import { useRegionsManagementQueries } from "@/composables/regionManagement/regionsManagementQueries";
import { useMutateLocations } from "@/composables/regionManagement/mutateLocations";
import { useLocationTreeNavigation } from "@/composables/regionManagement/locationTreeNavigation";

import ONTOLOGY_ENTRIES_QUERY from '../../graphql/ontology/entries.graphql'
import LocationNode from './LocationNode.vue'
import LocationMap from './LocationMap.vue'

const locationTree = useLocationTreeNavigation()
const mutateLocations = useMutateLocations()

const {
  countries,
  countriesLoading,
} = useRegionsManagementQueries()

const {
  selectedLocationId,
  handleToggleExpanded,
  handleSelectLocation,
  isExpanded,
  regions,
  regionsLoading,
  refetchRegions
} = locationTree

const {
  createLocation,
  createLocationLoading,

  updateLocation,
  updateLocationLoading
} = mutateLocations

const selectedCountry = ref(null)
const isModalOpen = ref(false)
const errorMessage = ref('')

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

const submitRegion = async () => {
    if (!selectedCountry.value) {
    errorMessage.value = 'Please select a country'
    return
  }

  errorMessage.value = ''

  try {

    const locationData = {
        name: selectedCountry.value.name,
        code: selectedCountry.value.code,
        typeId: selectedCountry.value.typeId
    }

    const { status, errors } = await createLocation(locationData)
    if (status === 'SUCCESS') {
      closeModal()
      await refetchRegions()
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        errorMessage.value = errors.map(err => err.message).join(', ')
      } else {
        errorMessage.value = 'Failed to create region. Please try again.'
      }
    }
  } catch (error) {
    console.error('Submit region failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const openModal = () => {
  selectedCountry.value = null
  errorMessage.value = ''
  isModalOpen.value = true
}

const closeModal = () => {
    isModalOpen.value = false
}

const updateCoordinatesError = ref(null)
const updateCoordinatesLoading = updateLocationLoading

// Handle coordinate updates from map
const handleUpdateCoordinates = async ({ locationId, coordinates }) => {
  try {
    const locationData = {
        locationId: locationId,
        coordinates: coordinates
      }

    const { status, errors } = await updateLocation( locationData )
    if (status !== 'SUCCESS') {
      // Handle server errors
      if (errors && errors.length > 0) {
        updateCoordinatesError.value = errors.map(err => err.message).join(', ')
      } else {
        updateCoordinatesError.value = 'Failed to update coordinates. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error updating coordinates:', error)
    updateCoordinatesError.value = `Failed to update coordinates: ${error}`
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