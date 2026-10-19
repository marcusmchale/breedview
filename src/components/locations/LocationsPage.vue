<script setup>

import { ref, shallowRef, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LocationMap from './LocationMap.vue'
import LocationTree from './LocationTree.vue'
import LocationCard from './LocationCard.vue'
import CreateLocationTreeModal from "@/components/locations/createLocationTreeModal.vue";
import LocationLayoutsPanel from '@/components/layouts/LocationLayoutsPanel.vue'
import LocationUnitsPanel from '@/components/units/LocationUnitsPanel.vue'
import { useLayoutRootsQuery } from '@/composables/layouts/layoutRootsQuery'
import { useUnitRootsQuery } from '@/composables/units/unitRootsQuery'

import { useMutateLocations } from "@/composables/locations/mutateLocations";
import { useLocationTreeQueries } from "@/composables/locations/locationTreeQueries";
import { useCanCreate, useCanCurate } from '@/composables/controls/useWriteAccess'


const {
  updateLocation,
  updateLocationLoading
} = useMutateLocations()

const route = useRoute()
const router = useRouter()

const enableCountries = ref(false)
// ?location=<id> opens a location's card and content, e.g. from a link elsewhere; ?tab=units its units
const displayedLocationId = ref(route.query.location ? String(route.query.location) : null)
const contentTab = ref(route.query.tab === 'units' ? 'units' : 'layouts')
watch([displayedLocationId, contentTab], ([location, tab]) => {
  const query = location ? { location, ...(tab === 'units' ? { tab } : {}) } : {}
  if (query.location !== route.query.location || query.tab !== route.query.tab) router.replace({ query })
})

// The tab counts: the layout trees and unit graphs at the location (the panels' own root queries, from the cache)
const { arrangements: layoutRoots } = useLayoutRootsQuery(displayedLocationId)
const { blocks: unitRoots } = useUnitRootsQuery({
  locationIds: computed(() => (displayedLocationId.value ? [displayedLocationId.value] : []))
})
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


  <div class="regions-management">
    <div class="regions-header">
      <button v-if="canCreate" @click="openCreateRegionModal" class="btn btn-primary">
        Register a location tree
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
            @drawn-change="onDrawnChange"
            @show-card="scrollToCard"
            @location-selected="onLocationSelected"
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

      <!-- What is at the selected location: only the open tab's content is loaded -->
      <div v-if="displayedLocationId" class="location-content">
        <div class="content-tabs" role="tablist">
          <button class="content-tab" role="tab" :class="{ active: contentTab === 'layouts' }" @click="contentTab = 'layouts'">
            Layouts ({{ layoutRoots.length }})
          </button>
          <button class="content-tab" role="tab" :class="{ active: contentTab === 'units' }" @click="contentTab = 'units'">
            Units ({{ unitRoots.length }})
          </button>
        </div>
        <LocationLayoutsPanel v-if="contentTab === 'layouts'" :location-id="displayedLocationId" />
        <LocationUnitsPanel v-else :location-id="displayedLocationId" />
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
  /* each panel keeps its own height: a long tree scrolls in its panel rather than stretching the map's */
  align-items: start;
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

.content-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 2px solid #dee2e6;
}

.content-tab {
  padding: 10px 18px;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  background: none;
  font-size: 1rem;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
}

.content-tab.active {
  color: #212529;
  border-bottom-color: #4caf50;
}

</style>