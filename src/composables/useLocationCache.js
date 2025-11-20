import { ref, computed } from 'vue'
//todo consider arrangements in the location cache so we can trigger reload of arrangments box on changes
// currently each location node handles its own arrangements,
// it is convoluted to signal back to manager then have each node watch for its id or similar to reload arrangements

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

  // A flat store of all layouts
  const allLayouts = ref ({}) // {layoutId: layout}
  // A map to a set of ids of root layouts for each location
  const locationArrangements = ref({}) // {locationId: {rootLayoutIds}}
  // and a map from each location to a set of all layoutIds
  const locationLayouts = ref({}) // {locationId: {layoutIds}}

  /**
   * Add or update a location in the cache
   */
  const addLocation = (location, regionId) => {
    const existingLocation = allLocations.value[location.id]
    const newChildren = location.children
      ? location.children.map(c => typeof c === 'object' ? c.id : c)
      : []

    if (existingLocation) {
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
   * Set the arrangements for a location
   */
  const setArrangements = (layouts, locationId) => {
      const existingArrangementIds = locationArrangements.value[locationId]
      if (existingArrangementIds) {
          existingArrangementIds.clear
          layouts.map(layout => existingArrangementIds.add(layout.id))
      } else {
          locationArrangements.value[locationId] = layouts
      }
      layouts.forEach(layout => {
          addLayout(layout, locationId)
      })
  }

  /**
   * Add a layout to the cache
   */
  const addLayout = (layout, locationId) => {
      if (!locationLayouts.value[locationId]) {
        locationLayouts.value[locationId] = new Set()
      }
      locationLayouts.value[locationId].add(layout.id)

      const newChildren = layout.children
        ? layout.children.map(c => typeof c === 'object' ? c.id : c)
        : []
      const existingLayout = allLayouts.value[layout.id]
      if (existingLayout) {
        existingLayout.name = layout.name
        existingLayout.type = layout.type
        existingLayout.parent = layout.parent
        existingLayout.axes.splice(0, existingLayout.axes.length, ...layout.axes)
        existingLayout.children.splice(0, existingLayout.children.length, ...newChildren)
        if (existingLayout.position) {
            existingLayout.position.splice(0, existingLayout.position.length, ...layout.position)
        } else {
            existingLayout.position = layout.position
        }
        existingLayout.location = layout.location

      } else {
        allLayouts.value[layout.id] = {
          ...layout,
          children: newChildren
        }
      }
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
   * Get arrangements for a location
   */
  const getArrangementIds = (locationId) => {
    // Ensure an array exists for this location
    if (!locationArrangements.value[locationId]) {
      locationArrangements.value[locationId] = new Set()
    }
    // Return the actual set reference so it updates reactively
    return locationArrangements.value[locationId]
  }

  const getLayoutIds = (locationId) => {
    // Ensure a set exists for this location
    if (!locationLayouts.value[locationId]) {
      locationLayouts.value[locationId] = new Set()
    }
    return locationLayouts.value[locationId]
  }

  const getLayout = (layoutId) => {
    return allLayouts.value[layoutId]
  }


  const getLayouts = (layoutIds) => {
      return Array.from(layoutIds)
          .map(id => getLayout(id))
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
   * Remove a layout from cache
   */
  const removeLayout = (layoutId, locationId) => {
    const layout = allLayouts.value[layoutId]
    if (!layout) return

    // Remove from parent's children array
    if (layout.parent?.id) {
      const parent = allLayouts.value[layout.parent.id]
      if (parent) {
        parent.children = parent.children.filter(id => id !== layoutId)
      }
    }
    // Remove from locationArrangements
    console.log('locationArrangements.value',locationArrangements.value)
    console.log('locationId', locationId)
    locationArrangements.value[locationId].delete(layoutId)
    // remove from locationLayouts
    locationLayouts.value[locationId].delete(layoutId)
    // Delete the layout
    delete allLayouts.value[layoutId]
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

    getArrangementIds,
    getLayoutIds,
    getLayout,
    getLayouts,

    // Write operations
    addLocation,
    addLocations,
    removeLocation,
    setArrangements,
    addLayout,
    removeLayout,

    // Cleanup
    clear,
    clearRegion
  }
}