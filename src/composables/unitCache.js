import { ref } from 'vue'

/**
 * Composable for managing a normalized, reactive block/unit cache
 * Supports hierarchical unit structures with add, update, delete operations
 *
 * Structure:
 *   allUnits: { [id]: unitObject }
 *   locationBlocks: { [locationId]: [root unitIds only] }
 *   locationUnits: { [locationId]: [all unitIds] }
 */
export function createUnitCache() {
  // A map of all units by ID
  const allUnits = ref(new Map()) // {unitId: unit}
  // A map to array of ids of root units (blocks) for each location
  const locationBlocks = ref(new Map()) // {locationId: [rootUnitIds]}
  // and a map from each location to array of all unitIds
  const locationUnits = ref(new Map()) // {locationId: [unitIds]}

  /**
   * Add a unit to the cache
   */

  const addUnit = (unit) => {
    const existingUnit = getUnit(unit.id)

    const locationIds = []
    unit.positions?.forEach(position => {
      locationIds.push(position.location.id)
    })

    // track unit in all of its locations
    locationIds.forEach(locationId => {
        if (!locationUnits.value.get(locationId)) {
            locationUnits.value.set(locationId, [])
        }
        if (!locationUnits.value.get(locationId).includes(unit.id)) {
            locationUnits.value.get(locationId).push(unit.id)
        }

        // Determine if this is a root unit (block) - has no parents or empty parents array
        const isRootUnit = !unit.parents || unit.parents.length === 0
        // Track root units in location blocks
        if (isRootUnit) {
            if (!locationBlocks.value.get(locationId)) {
            locationBlocks.value.set(locationId, [])
            }
            if (!locationBlocks.value.get(locationId).includes(unit.id)) {
            locationBlocks.value.get(locationId).push(unit.id)
            }
        } else {
            // todo, this should consider the existingUnit data (and remove if not in new layout positions.
            //  rather than relying on continued presence but no longer at root
            //  consider what we do with layoutCache in addLayout
            // handle merging blocks (i.e. was root but no longer is)
            // find index if it is in locationBlocks and remove it
            let index = locationBlocks.value.get(locationId)?.indexOf(unit.id) || -1
            if (index !== -1) {
                console.log('remove', unit.id , 'from root list for location', locationId)
                locationBlocks.value.get(locationId).splice(index, 1)
            }
        }

    })

    const newChildren = unit.children
      ? unit.children.map(c => typeof c === 'object' ? c.id : c)
      : []
    const newParents = unit.parents
      ? unit.parents.map(p => typeof p === 'object' ? p.id : p)
      : []


    if (existingUnit) {
      existingUnit.name = unit.name
      existingUnit.synonyms = unit.synonyms || []
      existingUnit.description = unit.description
      existingUnit.subject = unit.subject
      existingUnit.positions = unit.positions || []
      existingUnit.children.splice(0, existingUnit.children.length, ...newChildren)
      if (existingUnit.parents) {
        existingUnit.parents.splice(0, existingUnit.parents.length, ...newParents)
      } else {
        existingUnit.parents = newParents
      }
    } else {
      allUnits.value.set(
          unit.id,
          {
            ...unit,
            synonyms: unit.synonyms || [],
            positions: unit.positions || [],
            children: newChildren,
            parents: newParents
          }
      )
    }
  }

  /**
   * Get blocks (root units) for a location
   */
  const getBlockIds = (locationId) => {
    // Ensure an array exists for this location
    if (!locationBlocks.value.get(locationId)) {
      locationBlocks.value.set(locationId, [])
    }
    // Return the actual set reference so it updates reactively
    return locationBlocks.value.get(locationId)
  }

  /**
   * Get all unit IDs for a location
   */
  const getUnitIds = (locationId) => {
    // Ensure an array exists for this location
    if (!locationUnits.value.get(locationId)) {
      locationUnits.value.set(locationId, [])
    }
    return locationUnits.value.get(locationId)
  }

  /**
   * Get a single unit by ID
   */
  const getUnit = (unitId) => {
    return allUnits.value.get(unitId)
  }

  /**
   * Get multiple units by IDs
   */
  const getUnits = (unitIds) => {
    return unitIds
      .map(id => getUnit(id))
      .filter(Boolean)
  }

  /**
   * Get child units of a parent unit
   */
  const getChildren = (parentUnit) => {
    if (!parentUnit?.children?.length) return []
    return parentUnit.children
      .map(childId => getUnit(childId))
      .filter(Boolean)
  }

  /**
   * Get the current position for a unit (most recent with no end date, or latest start)
   */
  const getCurrentPosition = (unit) => {
    if (!unit.value?.positions?.length) return null
    // First try to find a position with no end date
    const activePosition = unit.value.positions.find(p => !p.end)
    if (activePosition) return activePosition
    // Otherwise return the position with the most recent start date
    return unit.value.positions.reduce((latest, current) => {
      if (!latest) return current
      const latestStart = latest.start ? new Date(latest.start) : new Date(0)
      const currentStart = current.start ? new Date(current.start) : new Date(0)
      return currentStart > latestStart ? current : latest
    }, null)
  }

  /**
   * Get the available parent units to set for a unit (during edit or create)
   * This is should be any units except self and children
   */
  const getAvailableParents = (unitId) => {
      const selfAndChildren = new Set()
      // Add all children recursively
      const addChildren = (unitId) => {
          selfAndChildren.add(unitId)
          const unit = getUnit(unitId)
          unit.children?.forEach(childId => {
              addChildren(childId)
          })
      }
      addChildren(unitId)
      return Array.from(allUnits.value.values())
          .filter(unit => !selfAndChildren.has(unit.id))
  }

  /**
   * Remove a unit from the cache
   */
  const removeUnit = (unitId) => {
    const unit = getUnit(unitId)
    if (!unit) return

    // Remove from parent's children array
    if (unit.parents?.length > 0) {
      unit.parents.forEach(parentId => {
        const parent = getUnit(parentId)
        if (parent) {
          parent.children = parent.children.filter(id => id !== unitId)
        }
      })
    }

    unit.positions.forEach(position =>{
        const locationId = position.locationId
        // Remove from locationBlocks if it's a root unit
        if (locationBlocks.value[locationId]) {
          locationBlocks.value[locationId].filter(id => id !== unitId)
        }
        // Remove from locationUnits
        if (locationUnits.value[locationId]) {
          locationUnits.value[locationId].filter(id => id !== unitId)
        }
    })

    // Delete the unit
    allUnits.value.delete(unitId)
  }

  return {
    // State
    allUnits,
    locationBlocks,
    locationUnits,

    // Read operations
    getBlockIds,
    getUnitIds,
    getUnit,
    getUnits,
    getChildren,
    getCurrentPosition,
    getAvailableParents,

    // Write operations
    addUnit,
    removeUnit,

  }
}