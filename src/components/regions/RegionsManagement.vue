<script setup>

import { ref } from 'vue'

import LocationMap from './LocationMap.vue'
import LocationTree from './LocationTree.vue'
import { useMutateLocations } from "@/composables/regions/mutateLocations";

const {
  updateLocation,
  updateLocationLoading
} = useMutateLocations()

const updateCoordinatesError = ref(null)
const updateCoordinatesLoading = updateLocationLoading

const displayedLocationId = ref(null)
const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
}

// Handle coordinate updates from map
// todo consider whether it makes more sense to move this to the map component?
// currently think not as we will need to provide other means to provide coordinates, such as text strings etc./
// though we might do this on the location node so it could be a separate handler
// but since this may still involve map interaction, such as viewing on the map before submitting,
// as such it may be better kept here for now
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

<template>
  <title>Regions</title>
  <div class="regions-management">
    <div class="regions-header">
      <h2>Regions Management</h2>
    </div>
    <div class="regions-content">
      <div class="regions-tree-panel">
        <LocationTree
          :showEdit=true
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

</style>