import { ref, computed } from 'vue'

/**
 * Composable for managing a normalized, reactive location cache
 * Supports hierarchical location structures with add, update, delete operations
 *
 * Structure:
 *   allLocations: { [id]: locationObject }
 *   regionLocations: { [regionId]: [locationIds] }
 */
export function useLocationCache() {
  // Flat store of all locations: { locationId: location }
  const allLocations = ref({})

  // Track which region owns which locations
  const regionLocations = ref({})  // { regionId: [locationIds] }
  // and the reverse map
  const locationRegions = ref({})



  /**
   * Add or update a location in the cache
   */
  const addLocation = (location, regionId) => {
    console.log('location being added', location.id)
    const existingLocation = allLocations.value[location.id]
    const newChildren = location.children
      ? location.children.map(c => typeof c === 'object' ? c.id : c)
      : []

    if (existingLocation) {
        console.log('location exists, updating:', location.id)
      // Update the existing location object in place to maintain reactivity
      existingLocation.name = location.name
      existingLocation.code = location.code
      existingLocation.description = location.description
      existingLocation.address = location.address
      existingLocation.type = location.type
      existingLocation.parent = location.parent
      existingLocation.coordinates.splice(0, existingLocation.coordinates.length, ...location.coordinates);
      // Update children array in place
      existingLocation.children.splice(0, existingLocation.children.length, ...newChildren)
    } else {
      // Create new location object if it doesn't exist
      allLocations.value[location.id] = {
        ...location,
        children: newChildren
      }
    }

    // Track location in region
    if (regionId) {
      if (!regionLocations.value[regionId]) {
        regionLocations.value[regionId] = []
      }
      if (!regionLocations.value[regionId].includes(location.id)) {
        regionLocations.value[regionId].push(location.id)
      }

      locationRegions.value[location.id] = regionId
    }
  }

  /**
   * Add multiple locations at once
   */
  const addLocations = (locations, regionId) => {
    locations.forEach(location => addLocation(location, regionId))
  }

  /**
   * Get a single location by ID
   */
  const getLocation = (id) => allLocations.value[id]

  /**
   * Get all child locations of a parent
   */
  const getChildren = (parentLocation) => {
    if (!parentLocation?.children?.length) return []
    return parentLocation.children
      .map(childId => allLocations.value[childId])
      .filter(Boolean)
  }

  /**
   * Get all locations in a region
   */
  const getRegionLocations = (regionId) => {
    const locationIds = regionLocations.value[regionId] || []
    return locationIds
      .map(id => allLocations.value[id])
      .filter(Boolean)
  }

    /**
   * Get region for a location
   */
  const getLocationRegionId = (locationId) => {
    return locationRegions.value[locationId]
  }


  /**
   * Get all region root locations
   * Returns the root location object for each region ID tracked in the cache
   */
  const getRegions = () => {
    return Object.keys(regionLocations.value)
      .map(regionId => allLocations.value[regionId])
      .filter(Boolean)
  }

  /**
   * Remove a location from cache
   */
  const removeLocation = (locationId) => {
    const location = allLocations.value[locationId]
    if (!location) return

    // Remove from parent's children array
    if (location.parent?.id) {
      const parent = allLocations.value[location.parent.id]
      if (parent) {
        parent.children = parent.children.filter(id => id !== locationId)
      }
    }

    // Remove from region tracking
    Object.keys(regionLocations.value).forEach(regionId => {
      const locationIds = regionLocations.value[regionId]
      const index = locationIds.indexOf(locationId)
      if (index > -1) {
        locationIds.splice(index, 1)
        // If this was a region root and it's now empty, delete the region key
        if (locationIds.length === 0) {
          delete regionLocations.value[regionId]
        }
      }
    })

    // Delete the location
    delete allLocations.value[locationId]
  }

  /**
   * Clear all cache data (useful for logout or fresh load)
   */
  const clear = () => {
    allLocations.value = {}
    regionLocations.value = {}
  }

  /**
   * Clear a specific region's cache
   */
  const clearRegion = (regionId) => {
    const locationIds = regionLocations.value[regionId] || []
    locationIds.forEach(id => delete allLocations.value[id])
    delete regionLocations.value[regionId]
  }

  /**
   * Compute all locations in a flattened array (for use in forms/dropdowns)
   */
  const getAllLocations = computed(() => {
    return Object.values(allLocations.value)
  })

  return {
    // State
    allLocations,
    regionLocations,
    getAllLocations,

    // Read operations
    getLocation,
    getChildren,
    getRegions,
    getRegionLocations,
    getLocationRegionId,

    // Write operations
    addLocation,
    addLocations,
    removeLocation,

    // Cleanup
    clear,
    clearRegion
  }
}