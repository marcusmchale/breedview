import { ref } from 'vue'

/**
 * Expansion of a location tree. A location's children are shown once loadChildren(locationId) has loaded them in one
 * request, so that each child node then reads its own location from the cache instead of sending a request.
 * loadParentId(locationId) gives the id of a location's parent, for expanding the tree down to a location.
 */
export function useLocationTreeNavigation(loadChildren, loadParentId) {
  const expandedLocations = ref(new Set())

  const isExpanded = (locationId) => {
    return expandedLocations.value.has(locationId)
  }

  const expandLocation = async (locationId) => {
    if (expandedLocations.value.has(locationId)) return
    try {
      await loadChildren(locationId)
    } finally {
      expandedLocations.value.add(locationId)
    }
  }

  const collapseLocation = (locationId) => {
    expandedLocations.value.delete(locationId)
  }

  const handleToggleExpanded = (locationId) => {
    if (expandedLocations.value.has(locationId)) {
      collapseLocation(locationId)
    } else {
      return expandLocation(locationId)
    }
  }

  /** Expand the locations above a location, from its root down, so that it shows in the tree */
  const expandTo = async (locationId) => {
    const ancestors = []
    let parentId = await loadParentId(locationId)
    while (parentId) {
      ancestors.unshift(parentId)
      parentId = await loadParentId(parentId)
    }
    for (const ancestorId of ancestors) {
      await expandLocation(ancestorId)
    }
  }

  return {
    expandedLocations,
    handleToggleExpanded,
    isExpanded,
    expandLocation,
    collapseLocation,
    expandTo
  }
}
