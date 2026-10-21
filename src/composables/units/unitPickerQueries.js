import { computed, ref, toValue } from 'vue'

import { useLocationRootsQuery } from '@/composables/locations/locationRootsQuery'
import { useLocationsLazyQuery } from '@/composables/locations/locationsLazyQuery'
import { useSelectUnitsQuery } from '@/composables/datasets/selectUnitsQueries'

// A location as a node of the unit picker: opened to see what is there, never chosen. Its id is a string of its own,
// as a location's id can be a unit's too.
const isLocation = (node) => node?.__typename === 'LocationNode'
const locationNode = (location) => ({
    __typename: 'LocationNode',
    id: `location:${location.id}`,
    name: location.name || `${location.type?.name} ${location.id}`,
    location
})

/**
 * A picker of one unit, found from where it is: the location trees, and at each location its child locations, unit
 * graphs and the units that arrived there (as the dataset unit picker offers them), opened level by level. Only a unit
 * the user can read can be chosen: a hidden one is a placeholder without a subject.
 */
export function useUnitPickerQueries({ unitId }) {
    const { regions } = useLocationRootsQuery()
    const {
        locations: childLocations,
        locationsLoading: childLocationsLoading,
        loadChildLocations
    } = useLocationsLazyQuery()

    // the location last opened: its unit graphs and arrivals are listed after its child locations
    const locationId = ref(null)
    const {
        rootNodes: unitsThere,
        blocksLoading: unitsThereLoading,
        loadChildren: loadUnitChildren,
        currentChildren: unitChildren,
        childrenLoading: unitChildrenLoading,
        isSelectable: isUnitNode,
        hasChildren: unitHasChildren,
        selectedUnits
    } = useSelectUnitsQuery({
        locationIds: () => (locationId.value ? [locationId.value] : []),
        unitIds: () => (toValue(unitId) ? [toValue(unitId)] : [])
    })

    const opened = ref(null)
    const loadChildren = (nodeId, node) => {
        opened.value = node
        if (isLocation(node)) {
            locationId.value = node.location.id
            return loadChildLocations(node.location.id)
        }
        return loadUnitChildren(nodeId, node)
    }

    const rootNodes = computed(() => (regions.value ?? []).map(locationNode))
    const currentChildren = computed(() => (isLocation(opened.value)
        ? [...(childLocations.value ?? []).map(locationNode), ...unitsThere.value]
        : unitChildren.value))
    const childrenLoading = computed(() => (isLocation(opened.value)
        ? !!childLocationsLoading.value || !!unitsThereLoading.value
        : !!unitChildrenLoading.value))

    // a location can hold units without child locations, so each can be opened
    const hasChildren = (node) => isLocation(node) || unitHasChildren(node)
    const isSelectable = (node) => !isLocation(node) && isUnitNode(node) && !!node.subject
    // locations, arrivals and the dropdown's own root crumb go by their names
    const nodeLabel = (node) => {
        if (node?.__typename !== 'Unit') return node.name
        return node.subject ? node.name || `${node.subject.name} ${node.id}` : `Unit ${node.id} (access restricted)`
    }
    const selectedUnit = computed(() => selectedUnits.value[0] ?? null)

    return {
        rootNodes,
        loadChildren,
        currentChildren,
        childrenLoading,
        hasChildren,
        isSelectable,
        nodeLabel,
        selectedUnit
    }
}
