<script setup>

import { ref } from 'vue'

import LocationMap from './LocationMap.vue'
import LocationTree from './LocationTree.vue'
import LocationCard from './LocationCard.vue'
import CreateRegionModal from "@/components/regions/createRegionModal.vue";

import { useMutateLocations } from "@/composables/regions/mutateLocations";
import { useLocationTreeQueries } from "@/composables/regions/locationTreeQueries";


const {
  updateLocation,
  updateLocationLoading
} = useMutateLocations()

const enableCountries = ref(false)
const displayedLocationId = ref(null)
const onLocationSelected = (locationId) => {
  console.log("Location selected:", locationId)
  displayedLocationId.value = locationId
}

const {
    locationTypes,
    locationTypesLoading,
    locationTypesError,

    countries,
    countriesLoading,
    countriesError,
    refetchRegions
} = useLocationTreeQueries(enableCountries, onLocationSelected)

const isCreateRegionModalOpen = ref(false)
const openCreateRegionModal = () => {
  enableCountries.value = true
  isCreateRegionModalOpen.value = true
}
const closeCreateRegionModal = () => {
    isCreateRegionModalOpen.value = false
}
const handleCreateRegionSuccess = async () => {
  await refetchRegions()
}

const updateCoordinatesError = ref(null)
const updateCoordinatesLoading = updateLocationLoading


const handleUpdateCoordinates = async ({ locationId, coordinates }) => {
  try {
    const locationData = {
        id: locationId,
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

<template>


  <title>Regions</title>
  <div class="regions-management">
    <div class="regions-header">
      <button @click="openCreateRegionModal" class="btn btn-primary">
        Register New Region
      </button>
    </div>
    <div class="regions-content">

      <div class="regions-top-row">
        <div class="regions-tree-panel">
          <LocationTree
            @location-selected="onLocationSelected"
          />
        </div>

        <div class="map-panel">
          <LocationMap
            :selectedLocationId="displayedLocationId"
            :updateCoodinatesLoading="updateCoordinatesLoading"
            :updateCoordinatesError="updateCoordinatesError"
            @update-coordinates="handleUpdateCoordinates"
          />
        </div>
      </div>
      <div v-if="displayedLocationId" class="card-panel">
        <LocationCard
          :locationId="displayedLocationId"
          :locationTypes="locationTypes"
        />
      </div>
    </div>

    <div v-if="isCreateRegionModalOpen" class="modal-overlay" @click="closeCreateRegionModal">
      <CreateRegionModal
          :countries="countries"
          :countriesLoading="countriesLoading"
          :countriesError="countriesError"
          :enableCountries="enableCountries"
          @success="handleCreateRegionSuccess"
          @close="closeCreateRegionModal"
      />
    </div>

  </div>
</template>

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

.regions-content {
  display: grid;
  flex-direction: column;
  gap: 20px;
}

.regions-top-row {
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

.card-panel {
  width: 100%;
}

</style>