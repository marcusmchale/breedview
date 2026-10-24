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
// The unit graphs and arrivals of one place, as a node of the units picker when they lie in more than one: opening it
// lists them, and its tick selects everything below it. It is not a unit, and its id is a string, so it is never taken
// for one. The place the units are going to (here) holds what is there already, so it is only shown.
export const isPlace = (node) => node?.__typename === 'UnitPlace'
const placeNode = ({ location, roots, arrivals, here }) => ({
    __typename: 'UnitPlace',
    id: `place:${location.id}`,
    name: here ? `${location.name} (already here)` : location.name,
    location,
    roots,
    arrivals,
    here,
    children: [...roots, ...arrivals]
})
// where a unit graph's root is: the location of its latest position the user can read
const placeOf = (unit) => [...(unit?.positions ?? [])]
    .sort((a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')))
    .map((position) => position.location)
    .find((location) => location?.id != null && location.name !== 'REDACTED') ?? null

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
 * A units picker, as a dataset's: the unit graphs rooted at the chosen locations (with below, and at every location
 * under them) and the arrivals there (units that came from elsewhere, e.g. samples at a lab), opened level by level;
 * when they lie in more than one place, a level for each place first. "By type…" selects all of a subject at once.
 * With here, the location the units are going to (as when they are received there): its own place is listed but can
 * be neither opened nor selected (isDisabled), since its units are there already; the places within it can be.
 */
export function useSelectUnitsQuery({locationIds, unitIds, below = false, here = null}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useUnitRootsQuery({locationIds: locationIds, below});

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

    const { result: arrivalsResult, loading: arrivalsLoading } = useQuery(
        UNITS_ARRIVALS_PICKER_QUERY,
        () => ({ locationIds: toValue(locationIds) ?? [], below }),
        { enabled: computed(() => (toValue(locationIds)?.length ?? 0) > 0) }
    )
    const arrivals = computed(() => (toValue(locationIds)?.length ? arrivalsResult.value?.unitsArrivals?.result ?? [] : [])
        .map(arrivalNode))

    // the places the unit graphs and arrivals lie in, by name
    const places = computed(() => {
        const hereId = toValue(here)
        const byId = new Map()
        const add = (location, node, kind) => {
            const place = location ?? { id: 'elsewhere', name: 'Elsewhere' }
            if (!byId.has(String(place.id))) {
                const isHere = hereId != null && String(place.id) === String(hereId)
                byId.set(String(place.id), { location: place, roots: [], arrivals: [], here: isHere })
            }
            byId.get(String(place.id))[kind].push(node)
        }
        blocks.value.forEach((unit) => add(placeOf(unit), unit, 'roots'))
        arrivals.value.forEach((arrival) => add(arrival.location, arrival, 'arrivals'))
        return [...byId.values()].sort((a, b) => a.location.name.localeCompare(b.location.name))
    })
    // a level for each place when they lie in more than one, or when one is where the units are going
    const byPlace = computed(() => places.value.length > 1 || places.value.some((place) => place.here))
    const rootNodes = computed(() => (byPlace.value ? places.value.map(placeNode) : [...blocks.value, ...arrivals.value]))
    const isDisabled = (node) => isPlace(node) && node.here
    const rootsLoading = computed(() => blocksLoading.value || arrivalsLoading.value)

    // An opened place lists its unit graphs and arrivals; an opened arrival its units, read in full so that those
    // holding others can be opened in turn
    const openedPlace = ref(null)
    const openedArrival = ref(null)
    const { units: arrivalUnits, unitsLoading: arrivalUnitsLoading } = useUnitsQuery({
        unitIds: computed(() => openedArrival.value?.children.map((unit) => unit.id) ?? [])
    })
    const loadChildren = (nodeId, node) => {
        openedPlace.value = isPlace(node) ? node : null
        openedArrival.value = isArrival(node) ? node : null
        if (openedPlace.value || openedArrival.value) return
        return loadDisplayedChildUnits(nodeId)
    }
    const currentChildren = computed(() => {
        if (openedPlace.value) return openedPlace.value.children
        return openedArrival.value ? arrivalUnits.value : displayedUnits.value
    })
    const childrenLoading = computed(() => {
        if (openedPlace.value) return false
        return openedArrival.value ? arrivalUnitsLoading.value : displayedUnitsLoading.value
    })

    // only units are selected; the tick of a place or an arrival selects what lies below it, which "By type…" in it
    // groups by subject
    const isSelectable = (node) => !isArrival(node) && !isPlace(node)
    const hasChildren = (node) => (isArrival(node) || isPlace(node) ? node.children.length > 0 : (node?.children?.length ?? 0) > 0)

    const { loadUnitGroups } = useUnitsBySubject()
    const groupsOf = async (roots, arrivalNodes) =>
        mergeGroups([...(await loadUnitGroups(roots ?? [])), ...arrivalNodes.flatMap(arrivalGroups)])
    const loadTypeGroups = async (node) => {
        if (isArrival(node)) return arrivalGroups(node)
        if (isPlace(node)) return groupsOf(node.roots, node.arrivals)
        if (node) return loadUnitGroups([node])
        // everything listed, but what is where the units are going
        const elsewhere = places.value.filter((place) => !place.here)
        return groupsOf(elsewhere.flatMap((place) => place.roots), elsewhere.flatMap((place) => place.arrivals))
    }

    return {
        blocks,
        blocksLoading,
        blocksError,
        arrivals,
        rootNodes,
        rootsLoading,

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
        isDisabled,
        hasChildren,
        loadTypeGroups
    }
}
