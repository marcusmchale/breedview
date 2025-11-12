
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

    <div class="drawing-controls">
      <button
        @click="submitCoordinates"
        class="draw-btn submit-btn"
        title="Submit coordinates"
        :disabled="!hasLayer"
      >
        ✓ Update Coordinates
      </button>
    </div>

    <div class="map-wrapper">
      <l-map
        ref="mapRef"
        v-model:zoom="zoom"
        v-model:center="center"
        :use-global-leaflet="true"
        @ready="onMapReady"
      >
        <l-tile-layer
          url="https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token={accessToken}"
          attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          :options="{ accessToken: mapboxToken }"
          layer-type="base"
          name="Mapbox"
          :max-zoom="19"
        />
      </l-map>
    </div>

    <div class="map-info">
      <p v-if="!selectedLocation" class="help-text">
        Select a location from the tree to view it on the map
      </p>
      <p v-else-if="childLocations.length === 0" class="help-text">
        No child locations with coordinates to display
      </p>
      <p v-else class="help-text">
        Showing {{ childLocations.length }} location{{ childLocations.length !== 1 ? 's' : '' }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed, toRaw } from 'vue'
import { LMap, LTileLayer } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import L from 'leaflet'
import 'leaflet-draw'
import { useLocationGeocoding } from '../composables/useLocationGeocoding'
import { useMutation } from '@vue/apollo-composable'
import UPDATE_LOCATION_MUTATION from '../graphql/regions/updateLocation.graphql'

// Add Mapbox token (get from environment variable)
const mapboxToken = `${process.env.VUE_APP_MAPBOX_TOKEN}`
console.log('Mapbox token:', mapboxToken)


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


const props = defineProps({
  selectedLocation: {
    type: Object,
    default: null
  },
  childLocations: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update-coordinates'])


// Map state
const mapRef = ref(null)
const zoom = ref(3)
const center = ref([10.2, 38.6])

// Drawing state
const drawnItems = new L.FeatureGroup()
const hasLayer = ref(false)  // to track if we get drawn items as vue3 isn't playing nicely with reactive leaflet
const displayedItems = new L.FeatureGroup()

// Composables
const { geocodeCountry } = useLocationGeocoding()
const { mutate: updateLocation } = useMutation(UPDATE_LOCATION_MUTATION)

// Filter child locations to only those with valid coordinates
const validChildLocations = computed(() => {
  return props.childLocations.filter(
    child => child?.coordinates && hasValidCoordinates(child.coordinates)
  )
})

// Initialize map
const onMapReady = () => {
  console.log('Map is ready')

  if (mapRef.value?.leafletObject) {
    const map = toRaw(mapRef.value.leafletObject)

    // Add feature group for drawn items
    if (!map.hasLayer(drawnItems)) {
      map.addLayer(drawnItems)
    }

    map.setView(center.value, zoom.value)

    // Initialize draw control with emoji marker icon
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: {
            stroke: true,
            color: '#007bff',
            weight: 2,
            opacity: 0.7,
            fill: true,
            fillColor: '#007bff',
            fillOpacity: 0.2
          }
        },
        marker: {
          icon: pinIcon
        },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    })
    map.addControl(drawControl)
    map._drawControl = drawControl

        // --- Reactive sync ---
    const updateHasLayer = () => {
      hasLayer.value = drawnItems.getLayers().length > 0;
    };

    drawnItems.on('layeradd', updateHasLayer);
    drawnItems.on('layerremove', updateHasLayer);

    // Set up draw event listeners
    map.on('draw:created', (e) => {
      const layer = e.layer
      drawnItems.addLayer(layer)
      updateHasLayer()
      console.log('Shape drawn:', layer)
    })

    map.on('draw:edited', (e) => {
      console.log('Shape edited:', e)
    })

    map.on('draw:deleted', (e) => {
      updateHasLayer()
      console.log('Shape deleted:', e)
    })

    // Handle draw:drawstart to track when drawing begins
    map.on('draw:drawstart', (e) => {
      console.log('Drawing started:', e)
      // Clear existing drawings
      drawnItems.clearLayers()
    })

    // Handle draw:drawstop to clear drawing mode
    map.on('draw:drawstop', (e) => {
      console.log('Drawing stopped:', e)
    })
  }
}


// Handle marker clicks
const handleMarkerClick = (location) => {
  console.log('Marker clicked:', location.name)
}

// Helper: validate coordinates object/values
const hasValidCoordinates = (coords) => {
  if (!coords) return false

  // Coordinates from GraphQL come as an array of GeoCoordinate objects
  if (Array.isArray(coords)) {
    if (coords.length === 0) return false

    // Check if it's an array of coordinate objects or an array of [lat, lng]
    if (typeof coords[0] === 'object' && coords[0] !== null) {
      console.log('Array of GeoCoordinate objects:', coords)
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
    console.log('Single GeoCoordinate object:', coords)
    const lat = Number(coords.latitude ?? coords.lat)
    const lng = Number(coords.longitude ?? coords.lng)
    console.log('lat, lng:', lat, lng)
    console.log(Number.isFinite(lat), Number.isFinite(lng), !Number.isNaN(lat), !Number.isNaN(lng))
    return Number.isFinite(lat) && Number.isFinite(lng) && !Number.isNaN(lat) && !Number.isNaN(lng)
  }

  return false
}

const submitCoordinates = () => {
  const layers = drawnItems.getLayers()

  if (layers.length === 0) {
    console.warn('No shapes drawn')
    return []
  }

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

  console.log('Submitting coordinates:', coordinates)

  // Emit the update-coordinates event with the collected data
  emit('update-coordinates', {
    locationId: props.selectedLocation?.id,
    coordinates: coordinates
  })

  // Clear drawn items and redraw
  drawnItems.clearLayers()
}


// Helper function to display location coordinates on map
const displayLocationCoordinates = (location) => {
  console.log('displayLocationCoordinates called for:', location?.name, location?.coordinates)

  if (!location?.coordinates || !mapRef.value?.leafletObject) {
    console.log('Cannot display - missing coordinates or map not ready')
    return
  }

  const map = toRaw(mapRef.value.leafletObject)

  // Check if displayedItems is on the map
  console.log('Is displayedItems on map?', map.hasLayer(displayedItems))
  if (!map.hasLayer(displayedItems)) {
    console.log('Adding displayedItems to map')
    map.addLayer(displayedItems)
  }

  const coords = location.coordinates
  console.log('Processing coordinates:', coords)

  // Check if it's a single point or polygon
  if (Array.isArray(coords) && coords.length > 0) {
    if (coords.length === 1) {
      // Single point - draw a marker with green icon
      const coord = coords[0]
      console.log('Creating marker at:', coord.latitude, coord.longitude)
      const marker = L.marker([coord.latitude, coord.longitude], {
        icon: selectedLocationIcon // Use green icon for selected location
      })
      displayedItems.addLayer(marker)
      marker.bindPopup(`<strong>${location.name}</strong><br/>Coordinates: ${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`)
      console.log('Marker added to displayedItems')
      console.log('Marker leaflet object:', marker)
      console.log('Marker position:', marker.getLatLng())
    } else {
      // Multiple points - draw a polygon
      console.log('Creating polygon with', coords.length, 'points')
      const latlngs = coords.map(coord => [coord.latitude, coord.longitude])
      console.log('Polygon latlngs:', latlngs)
      const polygon = L.polygon(latlngs, {
        color: '#28a745',
        weight: 2,
        opacity: 0.7,
        fillColor: '#28a745',
        fillOpacity: 0.2
      })
      displayedItems.addLayer(polygon)
      polygon.bindPopup(`<strong>${location.name}</strong><br/>Polygon with ${coords.length} points`)
      console.log('Polygon added to displayedItems')
    }
  }

  console.log('Total layers in displayedItems:', displayedItems.getLayers().length)
  console.log('DisplayedItems bounds:', displayedItems.getBounds())

  // Force map to show the displayed items
  const bounds = displayedItems.getBounds()
  if (bounds.isValid()) {
    console.log('Fitting map to displayedItems bounds')
    map.fitBounds(bounds, { padding: [50, 50] })
  } else {
    console.log('DisplayedItems bounds are not valid')
  }
}

// Helper function to display child locations on map
const displayChildLocations = () => {
  console.log('displayChildLocations called, valid children:', validChildLocations.value.length)

  if (!mapRef.value?.leafletObject) {
    console.log('Map not ready')
    return
  }

  const map = toRaw(mapRef.value.leafletObject)

  // Check if displayedItems is on the map
  if (!map.hasLayer(displayedItems)) {
    console.log('Adding displayedItems to map (from displayChildLocations)')
    map.addLayer(displayedItems)
  }

  validChildLocations.value.forEach(child => {
    console.log('Processing child:', child.name, child.coordinates)
    const coords = child.coordinates

    if (Array.isArray(coords) && coords.length > 0) {
      if (coords.length === 1) {
        // Single point - draw a marker with blue icon
        const coord = coords[0]
        console.log('Creating child marker at:', coord.latitude, coord.longitude)
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
        console.log('Child marker added')
      } else {
        // Multiple points - draw a polygon with blue color
        console.log('Creating child polygon with', coords.length, 'points')
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
        console.log('Child polygon added')
      }
    }
  })

  console.log('Total layers in displayedItems after children:', displayedItems.getLayers().length)
}


/**
 * Check if location has coordinates in cache and update if missing
 */
const updateCoordinatesIfNeeded = async (location, geocodedCoords) => {
  if (!geocodedCoords || !location?.id) return false

  try {
    // Check if location already has coordinates
    if (location.coordinates?.latitude && location.coordinates?.longitude) {
      console.log(`Location "${location.name}" already has stored coordinates`)
      return false
    }

    // Prepare coordinates as GeoCoordinateInput list
    const coordinatesInput = [{
      latitude: geocodedCoords.latitude,
      longitude: geocodedCoords.longitude
    }]

    // Submit update with coordinates
    const result = await updateLocation({
      location: {
        locationId: location.id,
        coordinates: coordinatesInput
      }
    })

    if (result?.data?.regionsUpdateLocation?.status === 'SUCCESS') {
      console.log(`Successfully updated coordinates for "${location.name}"`)
      // Update the location object in place to maintain cache reactivity
      location.coordinates = [{
        latitude: geocodedCoords.latitude,
        longitude: geocodedCoords.longitude
      }]
      return true
    } else {
      const errorMsg = result?.data?.regionsUpdateLocation?.errors?.[0]?.message
      console.warn('Update failed:', errorMsg || 'Failed to update coordinates')
      return false
    }
  } catch (err) {
    console.error('Error updating coordinates:', err)
    return false
  }
}

// Watch for selected location changes
watch(() => props.selectedLocation, async (newLocation) => {

  if (!newLocation) return

  // Clear all displayed items
  displayedItems.clearLayers()

  // Display the selected location's coordinates on the map
  displayLocationCoordinates(newLocation)

  // Display child locations
  displayChildLocations()

  // First, check if location has children with VALID coordinates
  const hasValidChildren = validChildLocations.value.length > 0
    // If location has children with coordinates, fit bounds to show all
  if (hasValidChildren) {
    console.log('Zoom to children:', newLocation.name)
    await nextTick()
    fitBoundsToChildren()
    return
  }

  // Otherwise if the location has coordinates, zoom to them
  if (newLocation.coordinates && hasValidCoordinates(newLocation.coordinates)) {
    console.log('Zoom to coordinates:', newLocation.name)
    await nextTick()

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
        padding: [50, 50],
        maxZoom: 12
      })
    } else {
      console.log('Zoom to single coordinate:', newLocation.name, newLocation.coordinates, newLocation.coordinates[0])
      const targetLat = newLocation.coordinates[0].latitude
      const targetLng = newLocation.coordinates[0].longitude
      map.setView([targetLat, targetLng], 4)

    }
    return
  }

  // Finally, if we don't have coordinates try to geocode by name
  // Only do this for countries as we don't want to give away private location information
  if (!newLocation.parent) {
    console.log('Geocoding location:', newLocation.name)
    const coords = await geocodeCountry(newLocation.name)
    if (coords && hasValidCoordinates(coords)) {
      toRaw(mapRef.value.leafletObject).setView([coords.latitude, coords.longitude], 4)

      // Check if location has coordinates in cache, update if needed
      await updateCoordinatesIfNeeded(newLocation, coords)

    } else {
      // If geocoding failed, avoid setting center to undefined
      console.warn('Geocode did not return valid coordinates for', newLocation.name, coords)
    }
  }
}, { immediate: true, deep: true })

// Watch for child locations changes
watch(() => props.childLocations, async (newChildren) => {
  if (newChildren.length > 0) {
    await nextTick()
    // Clear and redraw all displayed items when children change
    displayedItems.clearLayers()

    // Redisplay the selected location
    if (props.selectedLocation) {
      displayLocationCoordinates(props.selectedLocation)
    }

    // Display the new children
    displayChildLocations()

    // Fit bounds to show all children
    fitBoundsToChildren()
  }
})

// Fit map bounds to show all child locations
const fitBoundsToChildren = () => {
  if (!mapRef.value?.leafletObject || props.childLocations.length === 0) return

  // Collect all lat/lng pairs from all children's coordinate arrays
  const validPoints = []

  props.childLocations.forEach(child => {
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
    console.warn('fitBoundsToChildren: no valid child coordinates, not changing map')
    return
  }
  const map = toRaw(mapRef.value.leafletObject)
  if (validPoints.length === 1) {
    map.setView([validPoints[0].latitude, validPoints[0].longitude], 4)
    return
  }
  const normalizedBounds = validPoints.map(coord => [
    coord.latitude,
    coord.longitude
  ])

  map.fitBounds(normalizedBounds, {
    padding: [50, 50],
    maxZoom: 12
  })
}

</script>

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


.drawing-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  flex-wrap: wrap;
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

.draw-btn.active {
  background-color: #007bff;
  color: white;
  border-color: #0056b3;
}

.draw-btn.clear-btn {
  background-color: #fff3cd;
  border-color: #ffc107;
}

.draw-btn.clear-btn:hover:not(:disabled) {
  background-color: #ffe69c;
  border-color: #ffb300;
}

.draw-btn.submit-btn {
  background-color: #28a745;
  color: white;
  border-color: #1e7e34;
  margin-left: auto;
}

.draw-btn.submit-btn:hover:not(:disabled) {
  background-color: #218838;
  border-color: #1e7e34;
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