
<script setup>
import {
  ref,
  computed,
  watch,
  toRaw,
  onBeforeUnmount
} from 'vue'
import { LMap } from '@vue-leaflet/vue-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'


import { useLocationGeocoding } from '@/composables/locations/useLocationGeocoding'
import { useLocationSearch } from '@/composables/locations/locationSearch'
import { addBaseMap, countryBounds } from '@/composables/locations/baseMap'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useLocationMapQueries } from "@/composables/locations/locationMapQueries";
import { alpha3ToAlpha2 } from "@/composables/locations/countryCodes";

const { locationId, selectedLocation, childLocations, childLocationsLoading, regionCountry } = useLocationMapQueries()

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
const emit = defineEmits(['drawn-change', 'show-card', 'location-selected'])

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
// BreedGraph's own locations, found by name for anyone; places (OpenStreetMap) for signed-in users only
const { searchLocations, loading: locationSearchLoading, error: locationSearchError } = useLocationSearch()
const searchLoading = computed(() => placeSearchLoading.value || locationSearchLoading.value)
const searchError = computed(() => locationSearchError.value || placeSearchError.value)

// Place search state
const placeQuery = ref('')
const locationResults = ref([])
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
  const [locations, places] = await Promise.all([
    searchLocations(placeQuery.value),
    isAuthenticated.value
      ? searchPlaces(placeQuery.value, {
        viewbox: getViewbox(),  // also prefers the visible area for the country and anywhere scopes
        bounded: searchScope.value === 'view',
        countryCode: searchScope.value === 'country' ? searchCountry.value?.alpha2 : null
      })
      : []
  ])
  if (request !== placeSearchRequest) return
  locationResults.value = locations
  placeResults.value = places
  placeSearched.value = true
}

// Keep the listed results in step with the chosen scope
watch(searchScope, () => {
  if (placeSearched.value) handlePlaceSearch()
})

const clearPlaceSearch = () => {
  placeSearchRequest++
  placeQuery.value = ''
  locationResults.value = []
  placeResults.value = []
  placeSearched.value = false
  searchResultLayer.clearLayers()
}

// A BreedGraph location is selected as from the tree: the page shows it on the map and opens its card
const goToLocation = (location) => {
  emit('location-selected', String(location.id))
  locationResults.value = []
  placeResults.value = []
  placeSearched.value = false
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
  locationResults.value = []
  placeResults.value = []
  placeSearched.value = false
}

let resizeObserver = null
onBeforeUnmount(() => resizeObserver?.disconnect())

// Initialize map
const onMapReady = () => {
  console.log('Map is ready')

  if (mapRef.value?.leafletObject) {
    const map = toRaw(mapRef.value.leafletObject)

    // the base map, from tiles our server serves
    addBaseMap(map)

    // Leaflet notices only window resizes: redraw whenever the layout resizes the map, so no grey area is left
    resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(map.getContainer())

    // Add feature group for drawn items
    if (!map.hasLayer(drawnItems)) {
      map.addLayer(drawnItems)
    }

    map.setView(center.value, zoom.value, { animate: false })
    // a location selected before the map was ready
    if (selectedLocation.value) {
      displayLocationCoordinates(selectedLocation.value)
      focusSelection()
    }

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

  placedChildren.value.forEach(child => {
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


// How far the map zooms to show a selected location: detailed maps start a few zooms above the world file's
const POINT_ZOOM = 14  // a single point, unless already zoomed in further
const SHAPE_MAX_ZOOM = 17
const CHILDREN_MAX_ZOOM = 14
// room around what is fitted, more at the top for the search box
const FIT_PADDING = { paddingTopLeft: [40, 90], paddingBottomRight: [40, 40] }

// [latitude, longitude] of valid coordinates
const coordinatePoints = (coordinates) => (coordinates ?? [])
  .map((coord) => [Number(coord.latitude ?? coord.lat), Number(coord.longitude ?? coord.lng)])
  .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))

// The selected location's children (those of the previous selection may still be loaded), and those with coordinates
const selectedChildren = computed(() => (childLocations.value ?? [])
  .filter((child) => child && String(child.parent?.id) === String(selectedLocation.value?.id)))
const placedChildren = computed(() => selectedChildren.value.filter((child) => coordinatePoints(child.coordinates).length))

// Below the map: how many of the selected location's children it shows, and how many have no coordinates
const childrenSummary = computed(() => {
  const name = selectedLocation.value?.name
  const all = selectedChildren.value.length
  const placed = placedChildren.value.length
  if (!all) {
    return selectedLocation.value?.children?.length && childLocationsLoading.value
      ? `Loading the locations below ${name}…`
      : `No locations below ${name}`
  }
  if (!placed) {
    return all === 1 ? `The location below ${name} has no coordinates` : `None of the ${all} locations below ${name} have coordinates`
  }
  if (placed === all) return `Showing the ${all === 1 ? 'location' : `${all} locations`} below ${name}`
  const unplaced = all - placed
  return `Showing ${placed} of the ${all} locations below ${name}; ${unplaced === 1 ? '1 has' : `${unplaced} have`} no coordinates`
})

const fitPoints = (map, points, maxZoom) => {
  if (points.length === 1) {
    map.setView(points[0], Math.max(map.getZoom(), POINT_ZOOM), { animate: false })
  } else {
    map.fitBounds(points, { ...FIT_PADDING, maxZoom, animate: false })
  }
}

// Nominatim's box for a country's name, asked once per country, for countries without an extent in tiles.json
const geocodedCountries = new Map()

/**
 * Show a country by its extent from the outline its maps were fetched with, or where there is none, by Nominatim's
 * box for its name (signed in only, as place searches need an account). Nothing is saved: countries need no
 * coordinates.
 */
const fitCountry = async (map, country, stillSelected) => {
  const bounds = await countryBounds(country.code)
  if (!stillSelected()) return
  if (bounds) {
    map.fitBounds(bounds, { ...FIT_PADDING, animate: false })
    return
  }
  if (!isAuthenticated.value) return
  const place = geocodedCountries.get(country.code) ?? await geocodeCountry(country.name)
  if (place) geocodedCountries.set(country.code, place)
  if (!stillSelected()) return
  if (place?.bounds) {
    map.fitBounds(place.bounds, { ...FIT_PADDING, animate: false })
  } else if (place && hasValidCoordinates(place)) {
    map.setView([place.latitude, place.longitude], 5, { animate: false })
  }
}

/**
 * Show the selected location: a country by its extent; anything else by its coordinates and those of its children,
 * or when none of them is placed, by its country
 */
const focusSelection = async () => {
  const location = selectedLocation.value
  if (!location || !mapRef.value?.leafletObject) return
  const map = toRaw(mapRef.value.leafletObject)
  // looking up a country's extent can take a moment, by when another location may be selected
  const stillSelected = () => selectedLocation.value?.id === location.id
  if (!location.parent) {
    await fitCountry(map, location, stillSelected)
    return
  }
  const own = coordinatePoints(location.coordinates)
  const children = placedChildren.value.flatMap((child) => coordinatePoints(child.coordinates))
  if (own.length || children.length) {
    fitPoints(map, [...own, ...children], children.length ? CHILDREN_MAX_ZOOM : SHAPE_MAX_ZOOM)
  } else if (regionCountry.value) {
    await fitCountry(map, regionCountry.value, stillSelected)
  }
}

// Watch for selected location changes
watch(selectedLocation, (newLocation) => {
  if (!newLocation) return
  displayedItems.clearLayers()
  displayLocationCoordinates(newLocation)
  focusSelection()
}, { immediate: true, deep: true })

// Watch for child locations changes
watch(childLocations, (newChildren) => {
  if (!newChildren?.length) return
  // Clear and redraw all displayed items when children change
  displayedItems.clearLayers()
  if (selectedLocation.value) displayLocationCoordinates(selectedLocation.value)
  displayChildLocations()
  focusSelection()
}, { deep: true })

// The selected location's country loads after it, for a location shown by its country
watch(() => regionCountry.value?.code, focusSelection)

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
      <div class="place-search">
        <form class="place-search-form" @submit.prevent="handlePlaceSearch">
          <input
            v-model="placeQuery"
            type="search"
            class="place-search-input"
            :placeholder="isAuthenticated ? `Search locations, and places ${scopeDescription(searchScope)}…` : 'Search locations…'"
            @keydown.esc="clearPlaceSearch"
          />
          <button
            type="submit"
            class="draw-btn"
            :disabled="searchLoading || !placeQuery.trim()"
          >
            {{ searchLoading ? 'Searching...' : 'Search' }}
          </button>
        </form>
        <div v-if="isAuthenticated" class="place-search-scope" role="radiogroup" aria-label="Search places in">
          <span class="place-search-scope-label">Places in:</span>
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
        <ul v-if="locationResults.length > 0 || placeResults.length > 0" class="place-results">
          <li v-if="locationResults.length > 0" class="place-results-heading">In BreedGraph</li>
          <li
            v-for="location in locationResults"
            :key="`location-${location.id}`"
            class="place-result location-result"
            @click="goToLocation(location)"
          >
            {{ location.name }}
            <span v-if="location.root && String(location.root.id) !== String(location.id)" class="location-result-context">
              in {{ location.root.name }}
            </span>
          </li>
          <li v-if="placeResults.length > 0" class="place-results-heading">Places</li>
          <li
            v-for="(place, index) in placeResults"
            :key="`place-${index}`"
            class="place-result"
            @click="goToPlace(place)"
          >
            {{ place.name }}
          </li>
        </ul>
        <p v-else-if="searchError" class="place-search-message error-message">
          {{ searchError }}
        </p>
        <p v-else-if="placeSearched && !searchLoading" class="place-search-message">
          <template v-if="isAuthenticated">No locations, and no places {{ scopeDescription(searchScope) }}.</template>
          <template v-else>No locations found.</template>
          <template v-for="option in (isAuthenticated ? widerScopes : [])" :key="option.value">
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
      <p v-else-if="selectedLocation" class="help-text">
        {{ childrenSummary }}
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

.place-results-heading {
  padding: 6px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6c757d;
}

.location-result-context {
  color: #6c757d;
}

.place-search-message {
  margin: 0;
  padding: 8px 10px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #666;
}

/* the map fills its wrapper, which the panel sizes; positioned so it doesn't need a parent of definite height */
.map-wrapper :deep(.leaflet-container) {
  position: absolute;
  inset: 0;
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