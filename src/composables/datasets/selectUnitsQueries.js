import { computed, ref, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import { useUnitRootsQuery } from "@/composables/units/unitRootsQuery"
import { useUnitsQuery } from "@/composables/units/unitsQuery"
import { useUnitsLazyQuery } from "@/composables/units/unitsLazyQuery";
import { useUnitsBySubject } from "@/composables/units/unitsBySubject";

import UNITS_ARRIVALS_PICKER_QUERY from '@/graphql/units/unitsArrivalsForPicker.graphql'

// An arrival as a node of the units picker: the units that came to a location together, which its tick selects. It
// is not a unit, and its id is a string, so it is never taken for one.
export const isArrival = (node) => node?.__typename === 'UnitArrival'
const arrivalNode = (arrival) => ({
    __typename: 'UnitArrival',
    id: `arrival:${arrival.location.id}:${arrival.start ?? 'undated'}`,
    name: `${arrival.start ? `Arrived ${arrival.start}` : 'Undated arrival'} at ${arrival.location.name}`,
    location: arrival.location,
    start: arrival.start,
    unitsBySubject: arrival.unitsBySubject,
    children: arrival.unitsBySubject.flatMap((group) => group.units)
})
// an arrival's units by subject, as the picker's "By type…" groups
const arrivalGroups = (arrival) => arrival.unitsBySubject.map((group) => ({
    key: group.subject?.id ?? 'none',
    label: group.subject?.name ?? 'No subject',
    nodes: group.units
}))
const mergeGroups = (groups) => {
    const byKey = new Map()
    for (const group of groups) {
        const merged = byKey.get(group.key) ?? { ...group, nodes: [] }
        const ids = new Set(merged.nodes.map((node) => node.id))
        merged.nodes = [...merged.nodes, ...group.nodes.filter((node) => !ids.has(node.id))]
        byKey.set(group.key, merged)
    }
    return [...byKey.values()]
}

/**
 * The units picker of a dataset: the unit graphs rooted at the chosen locations and the arrivals there (units that
 * came from elsewhere, e.g. samples at a lab), opened level by level; "By type…" selects all of a subject at once.
 */
export function useSelectUnitsQuery({locationIds, unitIds}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useUnitRootsQuery({locationIds: locationIds});

    const {
        units: selectedUnits,
        unitsLoading: selectedUnitsLoading,
        unitsError: selectedUnitsError
    } = useUnitsQuery({unitIds: unitIds})

    const {
        units: displayedUnits,
        loadUnits: loadDisplayedUnits,
        loadChildUnits: loadDisplayedChildUnits,
        unitsLoading: displayedUnitsLoading
    } = useUnitsLazyQuery()

    const { result: arrivalsResult } = useQuery(
        UNITS_ARRIVALS_PICKER_QUERY,
        () => ({ locationIds: toValue(locationIds) ?? [] }),
        { enabled: computed(() => (toValue(locationIds)?.length ?? 0) > 0) }
    )
    const arrivals = computed(() => (toValue(locationIds)?.length ? arrivalsResult.value?.unitsArrivals?.result ?? [] : [])
        .map(arrivalNode))
    const rootNodes = computed(() => [...blocks.value, ...arrivals.value])

    // An opened arrival lists its units, read in full so that those holding others can be opened in turn
    const openedArrival = ref(null)
    const { units: arrivalUnits, unitsLoading: arrivalUnitsLoading } = useUnitsQuery({
        unitIds: computed(() => openedArrival.value?.children.map((unit) => unit.id) ?? [])
    })
    const loadChildren = (nodeId, node) => {
        if (isArrival(node)) {
            openedArrival.value = node
            return
        }
        openedArrival.value = null
        return loadDisplayedChildUnits(nodeId)
    }
    const currentChildren = computed(() => (openedArrival.value ? arrivalUnits.value : displayedUnits.value))
    const childrenLoading = computed(() => (openedArrival.value ? arrivalUnitsLoading.value : displayedUnitsLoading.value))

    // only units are selected; an arrival's tick selects its units, which "By type…" in it groups by subject
    const isSelectable = (node) => !isArrival(node)
    const hasChildren = (node) => (isArrival(node) ? node.children.length > 0 : (node?.children?.length ?? 0) > 0)

    const { loadUnitGroups } = useUnitsBySubject()
    const loadTypeGroups = async (node) => {
        if (isArrival(node)) return arrivalGroups(node)
        if (node) return loadUnitGroups([node])
        return mergeGroups([...(await loadUnitGroups(blocks.value ?? [])), ...arrivals.value.flatMap(arrivalGroups)])
    }

    return {
        blocks,
        blocksLoading,
        blocksError,
        arrivals,
        rootNodes,

        selectedUnits,
        selectedUnitsLoading,
        selectedUnitsError,

        displayedUnits,
        displayedUnitsLoading,
        loadDisplayedUnits,
        loadDisplayedChildUnits,

        loadChildren,
        currentChildren,
        childrenLoading,
        isSelectable,
        hasChildren,
        loadTypeGroups
    }
}
