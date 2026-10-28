<script setup>

import { ref, shallowRef, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { plural } from '@/composables/system/counts'

import LocationMap from './LocationMap.vue'
import LocationTree from './LocationTree.vue'
import LocationCard from './LocationCard.vue'
import CreateLocationTreeModal from "@/components/locations/createLocationTreeModal.vue";
import LocationLayoutsPanel from '@/components/layouts/LocationLayoutsPanel.vue'
import { useLayoutRootsQuery } from '@/composables/layouts/layoutRootsQuery'
import { useUnitRootsQuery } from '@/composables/units/unitRootsQuery'
import { useUnitArrivalsQuery } from '@/composables/units/unitArrivalsQuery'

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
// ?location=<id> opens a location's card and layouts, e.g. from a link elsewhere; the address follows the selection
const displayedLocationId = ref(route.query.location ? String(route.query.location) : null)
watch(displayedLocationId, (location) => {
  if ((location ?? undefined) !== route.query.location) router.replace({ query: location ? { location } : {} })
})
watch(() => route.query.location, (location) => {
  displayedLocationId.value = location ? String(location) : null
})

// The layout trees at the location (the panel's own root query, from the cache), and what the Units page has there
const { arrangements: layoutRoots } = useLayoutRootsQuery(displayedLocationId)
const displayedLocationIds = computed(() => (displayedLocationId.value ? [displayedLocationId.value] : []))
const { blocks: unitRoots } = useUnitRootsQuery({ locationIds: displayedLocationIds })
const { arrivals } = useUnitArrivalsQuery({ locationIds: displayedLocationIds })
// drawing sets the selected location's coordinates, so the tools are offered only to those who can change it
const canCreate = useCanCreate()
const canCurateDisplayed = useCanCurate({ entityLabel: 'LOCATION', entityId: displayedLocationId })
const onLocationSelected = (locationId) => {
  displayedLocationId.value = locationId
  updateCoordinatesError.value = null
}

const {
    locationTypes,

    countries,
    countriesLoading,
    countriesError,
    refetchRegions
} = useLocationTreeQueries(enableCountries)

const isCreateRegionModalOpen = ref(false)
const openCreateRegionModal = () => {
  enableCountries.value = true
  isCreateRegionModalOpen.value = true
}
const closeCreateRegionModal = () => {
    isCreateRegionModalOpen.value = false
}
// The country added is selected, so the map shows it and where its detailed maps stand
const handleCreateRegionSuccess = async (country) => {
  const { data } = await refetchRegions() ?? {}
  const created = data?.locationsRoots?.result?.find((root) => root.code === country?.code)
  if (created) onLocationSelected(String(created.id))
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
            :selectedLocationId="displayedLocationId"
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

      <!-- What is at the selected location: its layouts here, its units on the Units page -->
      <div v-if="displayedLocationId" class="location-content">
        <div class="content-header">
          <h3 class="content-title">Layouts ({{ layoutRoots.length }})</h3>
          <router-link class="units-link" :to="{ name: 'Units', query: { location: displayedLocationId } }">
            Units at this location: {{ plural(unitRoots.length, 'unit graph') }}, {{ plural(arrivals.length, 'arrival') }}
          </router-link>
        </div>
        <p class="content-help">
          Layouts are coordinate spaces within the location, for places the map can't tell apart. Typically they place
          units relative to one another, such as the rows and columns of plots in a field or the benches of a
          greenhouse, but any space units have a place in will do, such as the wells of a plate. A layout names its axes
          (e.g. Row, Column), and a unit's position in it gives a value on each, in order. A layout can hold others,
          each at a position on its parent's axes, e.g. trays on the shelves of a growth room, each tray a grid of its
          own. Analyses can group records by layout axes, e.g. by row.
        </p>
        <LocationLayoutsPanel :location-id="displayedLocationId" />
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
  grid-template-columns: minmax(0, 1fr);  /* as wide as the page, whatever the width of its contents */
  gap: 20px;
}

.regions-top-row {
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
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

.content-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #dee2e6;
}

.content-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #212529;
}

.content-help {
  max-width: 90ch;
  margin: 0 0 16px;
  color: #555;
  font-size: 0.9rem;
  line-height: 1.5;
}

.units-link {
  font-size: 0.9rem;
  color: var(--brand-accent-darker);
}

/* too narrow for the tree beside the map: the map goes below it */
@media (max-width: 900px) {
  .regions-top-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>