<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import LocationTree from '@/components/locations/LocationTree.vue'
import LocationUnitsPanel from './LocationUnitsPanel.vue'
import ReceiveUnitsModal from './receiveUnitsModal.vue'

import { useLocationNodeQueries } from '@/composables/locations/locationNodeQueries'
import { arrivalParam, placeNow, useUnitWithAncestors } from '@/composables/units/unitPlaces'
import { useCanCreate } from '@/composables/controls/useWriteAccess'

// Units by location: a location tree, and at the selected location its unit graphs and arrivals. What is selected is
// in the address (location, graph, arrival, from, unit), so a link from anywhere can open any of it.
const route = useRoute()
const router = useRouter()

const param = (name) => (route.query[name] ? String(route.query[name]) : null)
const locationId = computed(() => param('location'))
const graph = computed(() => param('graph'))
const arrival = computed(() => param('arrival'))
const from = computed(() => param('from'))
const unit = computed(() => param('unit'))

const { location } = useLocationNodeQueries({ locationId })

// a change on the page replaces the address; moving to another location adds to the history
const update = (changes) => {
  const query = { ...route.query, ...changes }
  for (const key of Object.keys(query)) {
    if (query[key] === null || query[key] === undefined) delete query[key]
  }
  router.replace({ query })
}
const onLocationSelected = (locationId_) => {
  if (locationId_ !== locationId.value) router.push({ query: { location: locationId_ } })
}

// A unit is opened where it is now: its own position now, or the nearest unit above it with one
const { loadUnitWithAncestors } = useUnitWithAncestors()
const goToUnit = async (unitId) => {
  const target = await loadUnitWithAncestors(unitId)
  const place = target ? placeNow(target) : null
  router.push({ query: { location: place?.location?.id ?? locationId.value, unit: unitId } })
}

// Units received here from elsewhere make an arrival here, which opens once they are moved (the backend checks that
// the user curates them; those who can write anything are offered it)
const canCreate = useCanCreate()
const receiving = ref(false)
const onReceived = ({ position }) => update({ graph: null, arrival: arrivalParam(position.start), from: null, unit: null })
</script>

<template>
  <div class="units-page">
    <div class="units-content">
      <div class="locations-panel">
        <LocationTree
          :selectedLocationId="locationId"
          @location-selected="onLocationSelected"
        />
      </div>

      <div class="location-units">
        <div v-if="!locationId" class="empty-selection">
          <p>Select a location to see its unit graphs and the units that came there</p>
        </div>
        <template v-else>
          <div class="location-header">
            <h2>{{ location?.name || `Location ${locationId}` }}</h2>
            <router-link class="location-link" :to="{ name: 'Locations', query: { location: locationId } }">
              Location details
            </router-link>
            <button v-if="canCreate" type="button" class="btn btn-sm btn-secondary receive" @click="receiving = true">
              Receive units…
            </button>
          </div>
          <div v-if="receiving" class="modal-overlay" @click="receiving = false">
            <ReceiveUnitsModal
              :locationId="locationId"
              :locationName="location?.name"
              @moved="onReceived"
              @close="receiving = false"
            />
          </div>
          <LocationUnitsPanel
            :key="locationId"
            :locationId="locationId"
            :graph="graph"
            :arrival="arrival"
            :from="from"
            :unit="unit"
            @update="update"
            @go-to-unit="goToUnit"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.units-page {
  padding: 20px;
}

.units-content {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.locations-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.location-units {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.location-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 12px;
}

.receive {
  margin-left: auto;
}

.location-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}

.location-link {
  font-size: 0.9rem;
  color: #1565c0;
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #999;
  font-size: 16px;
  font-style: italic;
  text-align: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* too narrow for the location tree beside the units: it goes above them */
@media (max-width: 1100px) {
  .units-content {
    grid-template-columns: minmax(0, 1fr);
  }

  .locations-panel {
    max-height: 40vh;
  }
}
</style>
