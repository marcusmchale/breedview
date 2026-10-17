<script setup>

import { ref, shallowRef } from 'vue'

import LocationMap from './LocationMap.vue'
import LocationTree from './LocationTree.vue'
import LocationCard from './LocationCard.vue'
import CreateLocationTreeModal from "@/components/locations/createLocationTreeModal.vue";

import { useMutateLocations } from "@/composables/locations/mutateLocations";
import { useLocationTreeQueries } from "@/composables/locations/locationTreeQueries";
import { useCanCreate, useCanCurate } from '@/composables/controls/useWriteAccess'


const {
  updateLocation,
  updateLocationLoading
} = useMutateLocations()

const enableCountries = ref(false)
const displayedLocationId = ref(null)
// drawing sets the selected location's coordinates, so the tools are offered only to those who can change it
const canCreate = useCanCreate()
const canCurateDisplayed = useCanCurate({ entityLabel: 'LOCATION', entityId: displayedLocationId })
const onLocationSelected = (locationId) => {
  console.log("Location selected:", locationId)
  displayedLocationId.value = locationId
  updateCoordinatesError.value = null
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

// Shape drawn on the map, waiting to be saved from the location card
const mapRef = ref(null)
const cardPanelRef = ref(null)
// shallowRef: Apollo freezes what it is given, which breaks if a deep reactive proxy still wraps it
const drawnCoordinates = shallowRef(null)

const onDrawnChange = (coordinates) => {
  drawnCoordinates.value = coordinates
}

const scrollToCard = () => {
  cardPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const discardDrawing = () => {
  mapRef.value?.clearDrawing()
}

const handleSaveDrawnCoordinates = async (payload) => {
  const saved = await handleUpdateCoordinates(payload)
  if (saved) discardDrawing()
}

// Returns true when the coordinates were saved
const handleUpdateCoordinates = async ({ locationId, coordinates }) => {
  updateCoordinatesError.value = null
  try {
    const locationData = {
        id: locationId,
        // plain copies so Apollo never receives (and freezes) reactive objects
        coordinates: coordinates.map(({ latitude, longitude }) => ({ latitude, longitude }))
      }

    const { status, errors } = await updateLocation( locationData ) ?? {}
    if (status === 'SUCCESS') {
      return true
    } else {
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
  return false
}

</script>

<template>


  <title>Regions</title>
  <div class="regions-management">
    <div class="regions-header">
      <button v-if="canCreate" @click="openCreateRegionModal" class="btn btn-primary">
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
            ref="mapRef"
            :selectedLocationId="displayedLocationId"
            :drawable="canCurateDisplayed"
            @update-coordinates="handleUpdateCoordinates"
            @drawn-change="onDrawnChange"
            @show-card="scrollToCard"
          />
        </div>
      </div>
      <div v-if="displayedLocationId" ref="cardPanelRef" class="card-panel">
        <LocationCard
          :locationId="displayedLocationId"
          :locationTypes="locationTypes"
          :drawnCoordinates="drawnCoordinates"
          :saveCoordinatesLoading="updateCoordinatesLoading"
          :saveCoordinatesError="updateCoordinatesError"
          @save-coordinates="handleSaveDrawnCoordinates"
          @discard-drawing="discardDrawing"
        />
      </div>
    </div>

    <div v-if="isCreateRegionModalOpen" class="modal-overlay" @click="closeCreateRegionModal">
      <CreateLocationTreeModal
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