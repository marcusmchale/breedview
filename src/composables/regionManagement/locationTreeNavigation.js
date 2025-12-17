
import { ref } from 'vue'
import { useLocationTreeQueries } from './locationTreeQueries'

/**
 * Composable for managing location tree expansion and selection state
 * Handles the UI state and automatically manages data loading
 *
 * @param {Function} onLocationSelected - Optional callback when a location is selected
 * @returns {Object} - Tree navigation methods, state, and query data
 */
export function useLocationTreeNavigation(onLocationSelected = null) {
  const selectedLocationId = ref(null)
  const expandedLocations = ref(new Set())

  // Always use the queries composable
  const {
    regions,
    regionsLoading,
    regionsError,
    refetchRegions,
    loadChildren,
    getCachedChildren
  } = useLocationTreeQueries()

  const handleToggleExpanded = (locationId) => {
    if (expandedLocations.value.has(locationId)) {
      expandedLocations.value.delete(locationId)
    } else {
      handleSelectLocation(locationId)
      expandedLocations.value.add(locationId)
    }
  }

  const handleSelectLocation = (locationId) => {
    selectedLocationId.value = locationId

    // Automatically load children when a location is selected
    loadChildren(locationId)

    // Call the optional callback if provided
    if (onLocationSelected && typeof onLocationSelected === 'function') {
      onLocationSelected(locationId)
    }
  }

  const isExpanded = (locationId) => {
    return expandedLocations.value.has(locationId)
  }

  /**
   * Manually expand a location (useful for programmatic expansion)
   */
  const expandLocation = (locationId) => {
    if (!expandedLocations.value.has(locationId)) {
      expandedLocations.value.add(locationId)
      loadChildren(locationId)
    }
  }

  /**
   * Manually collapse a location
   */
  const collapseLocation = (locationId) => {
    expandedLocations.value.delete(locationId)
  }

  /**
   * Clear all expansions
   */
  const collapseAll = () => {
    expandedLocations.value.clear()
  }

  return {
    // Navigation state
    selectedLocationId,
    expandedLocations,

    // Navigation methods
    handleToggleExpanded,
    handleSelectLocation,
    isExpanded,
    expandLocation,
    collapseLocation,
    collapseAll,

    // Query data
    regions,
    regionsLoading,
    regionsError,
    refetchRegions,

    // Query methods
    loadChildren,
    getCachedChildren
  }
}