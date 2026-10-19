
<script setup>
import {
  ref,
  computed,
  watch,
  toRaw
} from 'vue'
import { LMap } from '@vue-leaflet/vue-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'


import { useLocationGeocoding } from '@/composables/locations/useLocationGeocoding'
import { addBaseMap } from '@/composables/locations/baseMap'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useLocationMapQueries } from "@/composables/locations/locationMapQueries";
import { alpha3ToAlpha2 } from "@/composables/locations/countryCodes";

const { locationId, selectedLocation, childLocations, regionCountry } = useLocationMapQueries()

// Place searches go through the API, which needs an account (breedgraph docs/front-end-changes.md §19)
const { isAuthenticated } = useAuthStore()

const props = defineProps({
  selectedLocationId: {
    type: String,
    default: null
  },
  // whether to offer the drawing tools, which set the selected location's coordinates
  drawable: {
    type: Boolean,
    default: false
  }
})

// Watch for selected location changes
watch(() => props.selectedLocationId, (newSelectedLocationId) => {
  locationId.value = newSelectedLocationId
  // a shape drawn for the previous location must not be saved against the new one
  clearDrawing()
})

// drawn-change: emits the drawn coordinates (or null when nothing is drawn) so the location card can save them
// show-card: the user asked to go to the location card to save the drawn shape
const emit = defineEmits(['update-coordinates', 'drawn-change', 'show-card'])

// Map state
// Create a custom emoji icon for markers
const createEmojiIcon = (emoji, size = 40, color = null) => {
  let html = `<div style="font-size: ${size}px; line-height: 1; text-align: center;`
  if (color) {
    html += ` color: ${color};`
  }
  html += `">${emoji}</div>`

  return L.divIcon({
    html: html,
    iconSize: [size, size],
    className: 'emoji-icon'
  })
}

const pinIcon = createEmojiIcon('📍', 40) // Red pin for user-drawn items
const selectedLocationIcon = createEmojiIcon('🟢', 40) // Green circle for selected location
const childLocationIcon = createEmojiIcon('🔵', 40) // Blue circle for child locations


const mapRef = ref(null)
const zoom = ref(3)
const center = ref([10.2, 38.6])

// Drawing state
const drawnItems = new L.FeatureGroup()
const hasLayer = ref(false)  // to track if we get drawn items as vue3 isn't playing nicely with reactive leaflet
const displayedItems = new L.FeatureGroup()

// Composables
const { geocodeCountry } = useLocationGeocoding()
// separate instance so country geocoding doesn't share loading/error state with the search box
const {
  searchPlaces,
  loading: placeSearchLoading,
  error: placeSearchError
} = useLocationGeocoding()

// Place search state
const placeQuery = ref('')
const placeResults = ref([])
const placeSearched = ref(false)
const searchResultLayer = new L.FeatureGroup()  // kept separate so results are never submitted as coordinates

// Search scope: 'view' (only the visible map area), 'country' (the selected location's country) or 'anywhere'
const searchScope = ref('anywhere')
const searchCountry = computed(() => {
  const alpha2 = alpha3ToAlpha2(regionCountry.value?.code)
  if (!alpha2) return null
  return { name: regionCountry.value.name, alpha2 }
})
const scopeOptions = computed(() => [
  { value: 'view', label: 'This view' },
  ...(searchCountry.value ? [{ value: 'country', label: searchCountry.value.name }] : []),
  { value: 'anywhere', label: 'Anywhere' }
])
const scopeDescription = (scope) => {
  if (scope === 'view') return 'in this view'
  if (scope === 'country') return `in ${searchCountry.value?.name}`
  return 'anywhere'
}
// Wider scopes to offer when a search finds nothing
const widerScopes = computed(() => {
  if (searchScope.value === 'view') {
    return scopeOptions.value.filter(option => option.value !== 'view')
  }
  if (searchScope.value === 'country') {
    return scopeOptions.value.filter(option => option.value === 'anywhere')
  }
  return []
})

// Default to the selected location's country, and reset to it when the country changes
watch(() => searchCountry.value?.alpha2, (alpha2) => {
  if (alpha2) {
    searchScope.value = 'country'
  } else if (searchScope.value === 'country') {
    searchScope.value = 'anywhere'
  }
}, { immediate: true })

// Visible map area as a Nominatim viewbox [west, south, east, north], or null when the whole world is in view
const getViewbox = () => {
  if (!mapRef.value?.leafletObject) return null
  const bounds = toRaw(mapRef.value.leafletObject).getBounds()
  let west = bounds.getWest()
  let east = bounds.getEast()
  if (east - west >= 360) return null
  // leaflet longitudes run past ±180 after panning across the antimeridian; shift back into range
  const shift = Math.round((west + east) / 2 / 360) * 360
  west -= shift
  east -= shift
  return [
    Math.max(-180, west),
    Math.max(-90, bounds.getSouth()),
    Math.min(180, east),
    Math.min(90, bounds.getNorth())
  ]
}

let placeSearchRequest = 0  // ignore responses from searches that have since been superseded
const handlePlaceSearch = async () => {
  if (!placeQuery.value.trim()) return
  const request = ++placeSearchRequest
  const results = await searchPlaces(placeQuery.value, {
    viewbox: getViewbox(),  // also prefers the visible area for the country and anywhere scopes
    bounded: searchScope.value === 'view',
    countryCode: searchScope.value === 'country' ? searchCountry.value?.alpha2 : null
  })
  if (request !== placeSearchRequest) return
  placeResults.value = results
  placeSearched.value = true
}

// Keep the listed results in step with the chosen scope
watch(searchScope, () => {
  if (placeSearched.value) handlePlaceSearch()
})

const clearPlaceSearch = () => {
  placeSearchRequest++
  placeQuery.value = ''
  placeResults.value = []
  placeSearched.value = false
  searchResultLayer.clearLayers()
}

const goToPlace = (place) => {
  if (!mapRef.value?.leafletObject) return
  const map = toRaw(mapRef.value.leafletObject)

  if (!map.hasLayer(searchResultLayer)) {
    map.addLayer(searchResultLayer)
  }
  searchResultLayer.clearLayers()
  const marker = L.circleMarker([place.latitude, place.longitude], {
    radius: 8,
    color: '#dc3545',
    weight: 2,
    fillColor: '#dc3545',
    fillOpacity: 0.4
  })
  marker.bindTooltip(place.name)
  searchResultLayer.addLayer(marker)

  if (place.bounds) {
    map.fitBounds(place.bounds, { maxZoom: 16 })
  } else {
    map.setView([place.latitude, place.longitude], 14)
  }
  placeResults.value = []
  placeSearched.value = false
}

// Initialize map
const onMapReady = () => {
  console.log('Map is ready')

  if (mapRef.value?.leafletObject) {
    const map = toRaw(mapRef.value.leafletObject)

    // the base map, from tiles our server serves
    addBaseMap(map)

    // Add feature group for drawn items
    if (!map.hasLayer(drawnItems)) {
      map.addLayer(drawnItems)
    }

    map.setView(center.value, zoom.value, { animate: false })

    // Initialize Geoman controls (similar to leaflet-draw), shown only while drawable
    map.pm.addControls({
      position: 'topleft',
      drawMarker: true,
      drawText: false,
      editControls: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
    })
    if (!props.drawable) map.pm.toggleControls()

    // Configure polygon drawing
    map.pm.setPathOptions({
      color: '#007bff',
      fillColor: '#007bff',
      fillOpacity: 0.2
    })

    // Set custom marker icon
    map.pm.setGlobalOptions({
      markerStyle: {
        icon: pinIcon
      }
    })

    // --- Reactive sync ---
    drawnItems.on('layeradd', syncDrawnCoordinates)
    drawnItems.on('layerremove', syncDrawnCoordinates)

    // Geoman event listeners (replaces draw:created, draw:deleted, etc.)
    map.on('pm:create', (e) => {
      const layer = e.layer
      // keep the emitted coordinates in step when the shape is edited or dragged
      layer.on('pm:edit', syncDrawnCoordinates)
      drawnItems.addLayer(layer)
    })

    map.on('pm:remove', (e) => {
      // removal mode takes the layer off the map but doesn't always remove it from our group
      if (drawnItems.hasLayer(e.layer)) {
        drawnItems.removeLayer(e.layer)
      }
    })

    map.on('pm:drawstart', () => {
      // Clear existing drawings
      drawnItems.clearLayers()
    })
  }
}


// Handle marker clicks
const handleMarkerClick = (location) => {
  console.debug('Marker clicked:', location.name)
}

// Helper: validate coordinates object/values
const hasValidCoordinates = (coords) => {
  if (!coords) return false

  // Coordinates from GraphQL come as an array of GeoCoordinate objects
  if (Array.isArray(coords)) {
    if (coords.length === 0) return false

    // Check if it's an array of coordinate objects or an array of [lat, lng]
    if (typeof coords[0] === 'object' && coords[0] !== null) {
      // Array of GeoCoordinate objects: [{ latitude, longitude }, ...]
      // Check if at least one coordinate in the array is valid
      return coords.some(coord => {
        const lat = Number(coord.latitude ?? coord.lat)
        const lng = Number(coord.longitude ?? coord.lng)
        return Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(lat) && !Number.isNaN(lng)
      })
    } else {
      // Array format: [lat, lng]
      const lat = Number(coords[0])
      const lng = Number(coords[1])
      return Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(lat) && !Number.isNaN(lng)
    }
  }

  // Single object format: { latitude, longitude }
  if (typeof coords === 'object') {
    const lat = Number(coords.latitude ?? coords.lat)
    const lng = Number(coords.longitude ?? coords.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(lat) && !Number.isNaN(lng)
  }

  return false
}

// Collect the coordinates of all drawn shapes
const getDrawnCoordinates = () => {
  const layers = drawnItems.getLayers()
  const coordinates = []

  layers.forEach(layer => {
    if (layer instanceof L.Marker) {
      // Handle marker
      const latlng = layer.getLatLng()
      coordinates.push({
        latitude: latlng.lat,
        longitude: latlng.lng
      })
    } else if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
      // Handle polygon or polyline
      const latlngs = layer.getLatLngs()
      // For polygons, getLatLngs() can return nested arrays for complex polygons
      // Flatten if needed (simple polygons return [[latlng, ...]])
      const flatLatlngs = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs

      flatLatlngs.forEach(latlng => {
        coordinates.push({
          latitude: latlng.lat,
          longitude: latlng.lng
        })
      })
    }
  })

  return coordinates
}

const syncDrawnCoordinates = () => {
  const coordinates = getDrawnCoordinates()
  hasLayer.value = coordinates.length > 0
  emit('drawn-change', hasLayer.value ? coordinates : null)
}

// Remove any drawn shapes, e.g. once they have been saved or discarded from the location card
const clearDrawing = () => {
  drawnItems.clearLayers()
  syncDrawnCoordinates()
}

const showDrawControls = (drawable) => {
  const map = mapRef.value?.leafletObject && toRaw(mapRef.value.leafletObject)
  if (!map?.pm) return
  if (map.pm.controlsVisible() !== drawable) map.pm.toggleControls()
  if (!drawable) {
    map.pm.disableDraw()
    clearDrawing()
  }
}
watch(() => props.drawable, showDrawControls)

defineExpose({ clearDrawing })


// Helper function to display location coordinates on map
const displayLocationCoordinates = (location) => {
  if(!location.parent) return // don't display a pin for country level
  if (!location?.coordinates || !mapRef.value?.leafletObject) {
    return
  }

  const map = toRaw(mapRef.value.leafletObject)

  // Check if displayedItems is on the map
  if (!map.hasLayer(displayedItems)) {
    map.addLayer(displayedItems)
  }

  const coords = location.coordinates
  if (coords.length === 0) return


  if (coords.length === 1) {
    // Single point - draw a marker with green icon
    const coord = coords[0]
    const marker = L.marker([coord.latitude, coord.longitude], {
      icon: selectedLocationIcon // Use green icon for selected location
    })
    displayedItems.addLayer(marker)
    marker.bindPopup(`<strong>${location.name}</strong><br/>Coordinates: ${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`)
  } else {
    // Multiple points - draw a polygon
    const latlngs = coords.map(coord => [coord.latitude, coord.longitude])
    const polygon = L.polygon(latlngs, {
      color: '#28a745',
      weight: 2,
      opacity: 0.7,
      fillColor: '#28a745',
      fillOpacity: 0.2
    })
    displayedItems.addLayer(polygon)
    polygon.bindPopup(`<strong>${location.name}</strong><br/>Polygon with ${coords.length} points`)
  }

  // Force map to show the displayed items
  const bounds = displayedItems.getBounds()
  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      //padding: [50, 50],
      maxZoom: zoom.value
    })
  }
}

// Helper function to display child locations on map
const displayChildLocations = () => {
  if (!childLocations.value) {
    console.debug('no children to display')
    return
  }


  if (!mapRef.value?.leafletObject) {
    console.log('Map not ready')
    return
  }

  const map = toRaw(mapRef.value.leafletObject)

  // Check if displayedItems is on the map
  if (!map.hasLayer(displayedItems)) {
    map.addLayer(displayedItems)
  }

  childLocations.value.forEach(child => {
    if (!child?.coordinates) {
      return
    }
    if (!hasValidCoordinates(child?.coordinates)) {
      return
    }

    const coords = child?.coordinates

    if (Array.isArray(coords) && coords.length > 0) {
      if (coords.length === 1) {
        // Single point - draw a marker with blue icon
        const coord = coords[0]
        const marker = L.marker([coord.latitude, coord.longitude], {
          icon: childLocationIcon // Use blue icon for child locations
        })
        displayedItems.addLayer(marker)

        // Build popup content
        let popupContent = `<div class="marker-popup"><h4>${child.name}</h4>`
        if (child.type) popupContent += `<p>Type: ${child.type.name}</p>`
        if (child.description) popupContent += `<p>${child.description}</p>`
        popupContent += `<p class="coordinates">Lat: ${coord.latitude.toFixed(6)}, Lng: ${coord.longitude.toFixed(6)}</p></div>`

        marker.bindPopup(popupContent)
        marker.bindTooltip(child.name)
        marker.on('click', () => handleMarkerClick(child))
      } else {
        // Multiple points - draw a polygon with blue color
        const latlngs = coords.map(coord => [coord.latitude, coord.longitude])
        const polygon = L.polygon(latlngs, {
          color: '#17a2b8', // Teal/blue for child polygons
          weight: 2,
          opacity: 0.7,
          fillColor: '#17a2b8',
          fillOpacity: 0.2
        })
        displayedItems.addLayer(polygon)

        let popupContent = `<div class="marker-popup"><h4>${child.name}</h4>`
        if (child.type) popupContent += `<p>Type: ${child.type.name}</p>`
        if (child.description) popupContent += `<p>${child.description}</p>`
        popupContent += `<p class="coordinates">Polygon with ${coords.length} points</p></div>`

        polygon.bindPopup(popupContent)
        polygon.on('click', () => handleMarkerClick(child))
      }
    }
  })
}


/**
 * Check if location has coordinates and update if missing
 */
const updateCoordinatesIfNeeded = async (location, geocodedCoords) => {
  if (!geocodedCoords || !location?.id) {
    return false
  }

  try {
    // Check if location already has coordinates
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      return false
    }

    // Prepare coordinates as GeoCoordinateInput list
    const coordinatesInput = [{
      latitude: geocodedCoords.latitude,
      longitude: geocodedCoords.longitude
    }]

  // Emit the update-coordinates event with the collected data
    emit('update-coordinates', {
      locationId: props.selectedLocationId,
      coordinates: coordinatesInput
    })
  } catch (err) {
    console.error('Error updating coordinates:', err)
    return false
  }
}


// Fit map bounds to show all child locations
const fitBoundsToChildren = () => {

  if (!mapRef.value?.leafletObject || childLocations.value?.length === 0) return

  // Collect all lat/lng pairs from all children's coordinate arrays
  const validPoints = []

  childLocations.value?.forEach(child => {
    if (child && child.coordinates && Array.isArray(child.coordinates)) {
      // Each child.coordinates is an array of Geocoordinate objects
      child.coordinates.forEach(coord => {
        const lat = Number(coord.latitude ?? coord.lat)
        const lng = Number(coord.longitude ?? coord.lng)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          validPoints.push({latitude:lat, longitude:lng})
        }
      })
    }
  })

  // If there are no valid points, do not change the map
  if (validPoints.length === 0) {
    return
  }
  const map = toRaw(mapRef.value.leafletObject)
  if (validPoints.length === 1) {
    map.setView([validPoints[0].latitude, validPoints[0].longitude], zoom.value, { animate: false })
    return
  }
  const normalizedBounds = validPoints.map(coord => [
    coord.latitude,
    coord.longitude
  ])
  map.fitBounds(normalizedBounds, {
    padding: [50, 50],
    maxZoom: 12,
    duration: 0  // if we animate it looks strange with the other layers as they are rendered in place before the pan
  })
}

// Watch for selected location changes
watch(selectedLocation, async (newLocation) => {
  if (!newLocation) return

  // Clear all displayed items
  displayedItems.clearLayers()
  // Display the selected location's coordinates on the map
  displayLocationCoordinates(newLocation)

  // Otherwise if the location has coordinates, zoom to them
  if (newLocation.coordinates && hasValidCoordinates(newLocation.coordinates)) {

    if (!mapRef.value?.leafletObject) {
      console.warn('Map not ready yet')
      return
    }

    const map = toRaw(mapRef.value.leafletObject)
    if (newLocation.coordinates.length > 1) {
      const normalizedBounds = newLocation.coordinates.map(coord => [
        coord.latitude,
        coord.longitude
      ])
      map.fitBounds(normalizedBounds, {
        //padding: [50, 50],
        maxZoom: zoom.value
      })
    } else {
      const targetLat = newLocation.coordinates[0].latitude
      const targetLng = newLocation.coordinates[0].longitude
      center.value = [targetLat, targetLng]
      map.setView([targetLat, targetLng], zoom.value,  { animate: false })
    }
    return
  }

  // If we don't have coordinates try to geocode by name
  // Only automatically do this for countries as we don't want to give away private location information,
  // and only signed in, as place searches need an account; the coordinates are saved only by those who can curate
  // todo add option to geocode by name for other locations
  if (!newLocation.parent && isAuthenticated.value) {
    const coords = await geocodeCountry(newLocation.name)
    if (coords && hasValidCoordinates(coords)) {
      toRaw(mapRef.value.leafletObject).setView([coords.latitude, coords.longitude], zoom.value, { animate: false })

      // Check if location has coordinates, update if needed
      if (props.drawable) await updateCoordinatesIfNeeded(newLocation, coords)

    } else {
      // If geocoding failed, avoid setting center to undefined
      console.warn('Geocode did not return valid coordinates for', newLocation.name, coords)
    }
  }
}, { immediate: true, deep: true })

// Watch for child locations changes
watch(childLocations, async (newChildren) => {
  if (!newChildren) return
  if (newChildren.length > 0) {
    //await nextTick()
    // Clear and redraw all displayed items when children change
    displayedItems.clearLayers()

    // Redisplay the selected location
    if (selectedLocation.value) {
      displayLocationCoordinates(selectedLocation.value)
    }

    // Display the new children
    displayChildLocations()

    // Fit bounds to show all children
    fitBoundsToChildren()
  }
}, { deep: true})

</script>


<template>
  <div class="location-map-container">
    <div class="map-header">
      <h3>Location Map</h3>
      <div v-if="selectedLocation" class="selected-info">
        <span class="selected-name">{{ selectedLocation.name }}</span>
        <span v-if="selectedLocation.type" class="selected-type">
          ({{ selectedLocation.type.name }})
        </span>
      </div>
    </div>

    <div class="map-wrapper">
      <button
        v-if="hasLayer && selectedLocation"
        type="button"
        class="unsaved-shape-cue"
        @click="emit('show-card')"
      >
        Unsaved shape for <strong>{{ selectedLocation.name }}</strong>. Save it on the location card below ↓
      </button>
      <div v-else-if="hasLayer" class="unsaved-shape-cue unsaved-shape-cue--warning">
        Select a location in the tree before drawing. Selecting one clears this shape.
      </div>
      <div v-if="isAuthenticated" class="place-search">
        <form class="place-search-form" @submit.prevent="handlePlaceSearch">
          <input
            v-model="placeQuery"
            type="search"
            class="place-search-input"
            :placeholder="`Search ${scopeDescription(searchScope)}…`"
            @keydown.esc="clearPlaceSearch"
          />
          <button
            type="submit"
            class="draw-btn"
            :disabled="placeSearchLoading || !placeQuery.trim()"
          >
            {{ placeSearchLoading ? 'Searching...' : 'Search' }}
          </button>
        </form>
        <div class="place-search-scope" role="radiogroup" aria-label="Search in">
          <span class="place-search-scope-label">Search in:</span>
          <div class="scope-toggle">
            <button
              v-for="option in scopeOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="searchScope === option.value"
              :class="['scope-option', { active: searchScope === option.value }]"
              @click="searchScope = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <ul v-if="placeResults.length > 0" class="place-results">
          <li
            v-for="(place, index) in placeResults"
            :key="index"
            class="place-result"
            @click="goToPlace(place)"
          >
            {{ place.name }}
          </li>
        </ul>
        <p v-else-if="placeSearchError" class="place-search-message error-message">
          {{ placeSearchError }}
        </p>
        <p v-else-if="placeSearched && !placeSearchLoading" class="place-search-message">
          No places found {{ scopeDescription(searchScope) }}.
          <template v-for="option in widerScopes" :key="option.value">
            ·
            <button type="button" class="link-btn" @click="searchScope = option.value">
              Search {{ scopeDescription(option.value) }}
            </button>
          </template>
        </p>
      </div>
      <l-map
        ref="mapRef"
        v-model:zoom="zoom"
        v-model:center="center"
        :use-global-leaflet="true"
        @ready="onMapReady"
      />
    </div>

    <div class="map-info">
      <p v-if="!selectedLocationId" class="help-text">
        Select a location from the tree to view it on the map
      </p>
      <p v-else-if="!childLocations || childLocations.length === 0" class="help-text">
        No child locations with coordinates to display
      </p>
      <p v-else class="help-text">
        Showing {{ childLocations.length }} location{{ childLocations.length !== 1 ? 's' : '' }}
      </p>
    </div>
  </div>
</template>


<style scoped>
.location-map-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 600px;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.map-header h3 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selected-name {
  font-weight: 600;
  color: #007bff;
  font-size: 16px;
}

.selected-type {
  color: #666;
  font-size: 14px;
}


.unsaved-shape-cue {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000; /* above the leaflet panes and controls */
  max-width: calc(100% - 40px);
  padding: 8px 14px;
  border: 1px solid #1e7e34;
  border-radius: 4px;
  background-color: #28a745;
  color: white;
  font-size: 14px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.unsaved-shape-cue:hover {
  background-color: #218838;
}

.unsaved-shape-cue--warning {
  border-color: #ffc107;
  background-color: #fff3cd;
  color: #664d03;
  cursor: default;
}

.draw-btn {
  padding: 8px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.draw-btn:hover:not(:disabled) {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.draw-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.map-wrapper {
  flex: 1;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ddd;
  min-height: 500px;
}

.place-search {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000; /* above the leaflet panes and controls */
  width: 320px;
  max-width: calc(100% - 70px);
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.place-search-form {
  display: flex;
  gap: 6px;
  padding: 6px;
}

.place-search-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.place-search-scope {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 6px;
  font-size: 12px;
  color: #666;
}

.place-search-scope-label {
  white-space: nowrap;
}

.scope-toggle {
  display: flex;
  min-width: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.scope-option {
  padding: 3px 8px;
  border: none;
  border-right: 1px solid #ddd;
  background-color: white;
  color: #333;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scope-option:last-child {
  border-right: none;
}

.scope-option:hover:not(.active) {
  background-color: #e9ecef;
}

.scope-option.active {
  background-color: #007bff;
  color: white;
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: #007bff;
  font-size: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.place-results {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid #eee;
  max-height: 240px;
  overflow-y: auto;
}

.place-result {
  padding: 8px 10px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
}

.place-result:hover {
  background-color: #e9ecef;
}

.place-search-message {
  margin: 0;
  padding: 8px 10px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #666;
}

.map-wrapper :deep(.leaflet-container) {
  height: 100%;
  width: 100%;
  z-index: 1;
}

.map-info {
  margin-top: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.help-text {
  margin: 0;
  font-size: 14px;
  color: #666;
  text-align: center;
}

.marker-popup {
  min-width: 200px;
}

.marker-popup h4 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.marker-popup p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.marker-popup .coordinates {
  font-size: 12px;
  color: #999;
  font-family: monospace;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

:deep(.emoji-icon) {
  background: none !important;
  border: none !important;
  filter: drop-shadow(1px 1px 2px rgba(0, 0, 0, 0.3));
}

</style>