import { computed, toValue } from 'vue'
import { useApolloClient, useMutation, useQuery } from '@vue/apollo-composable'

import { evictUnitsByLocation } from '@/composables/units/unitPlaces'

import UNIT_DERIVATIONS_QUERY from '@/graphql/units/unitDerivations.graphql'
import UNIT_DERIVATION_FRAGMENT from '@/graphql/units/unitDerivationFragment.graphql'
import DERIVE_UNITS_MUTATION from '@/graphql/units/deriveUnits.graphql'

/**
 * A unit derived from others: material that starts a context of its own, e.g. plantlets in a field grown from
 * microcuttings that arrived from a lab (breedgraph README, Unit). Unlike a parent, a unit derived from passes nothing
 * down: the derived unit is in a unit graph of its own, and the link is its history.
 */

// the stage the material was at when it became the unit (DerivationStage): a physical form, not the genetic
// relationship germplasm entries describe. A graft is derived from several units, each at its own stage.
export const DERIVATION_STAGES = [
    { value: 'UNKNOWN', label: 'Unknown' },
    { value: 'SEED', label: 'Seed', help: 'Seed, or a seed lot' },
    { value: 'SEEDLING', label: 'Seedling', help: 'A young plant grown from seed' },
    { value: 'CUTTING', label: 'Cutting', help: 'An unrooted vegetative piece: a stem or nodal cutting, budwood, a scion, a bud chip' },
    { value: 'ROOTED_CUTTING', label: 'Rooted cutting', help: 'A rooted vegetative piece' },
    { value: 'PLANT', label: 'Plant', help: 'An established whole plant: give its approximate stage in the description' },
    {
        value: 'IN_VITRO', label: 'In vitro',
        help: 'Material in culture: an explant, callus, somatic embryos, embryo rescue, anther or microspore culture, a micro-graft, a cryopreserved shoot tip'
    },
    { value: 'PLANTLET', label: 'Plantlet', help: 'In vitro material acclimatised ex vitro' }
]
const STAGE_LABELS = Object.fromEntries(DERIVATION_STAGES.map((stage) => [stage.value, stage.label]))
export const stageLabel = (stage) => (stage && stage !== 'UNKNOWN' ? STAGE_LABELS[stage] ?? stage : null)
// for a select: each stage with its meaning
export const STAGE_OPTIONS = DERIVATION_STAGES.map(({ value, label, help }) => ({
    value, label: help ? `${label}: ${help.charAt(0).toLowerCase()}${help.slice(1)}` : label
}))

/** What a unit's material came from and the units derived from it that the user can read */
export function useUnitDerivationsQuery(unitId) {
    const enabled = computed(() => !!toValue(unitId))

    const {
        result,
        loading: derivationsLoading,
        error: derivationsError,
        refetch: refetchDerivations
    } = useQuery(
        UNIT_DERIVATIONS_QUERY,
        () => ({ unitIds: [toValue(unitId)] }),
        { enabled }
    )

    const unit = computed(() => (enabled.value ? result.value?.unitsUnits?.result?.[0] ?? null : null))
    const derivedFrom = computed(() => unit.value?.derivedFrom ?? [])
    const derivatives = computed(() => unit.value?.derivatives ?? [])

    return { derivedFrom, derivatives, derivationsLoading, derivationsError, refetchDerivations }
}

/** The units a unit is derived from, as the cache has them, or null if it has not read them */
export const cachedDerivedFrom = (cache, unitId) => {
    const cached = cache.readFragment({
        id: cache.identify({ __typename: 'Unit', id: unitId }),
        fragment: UNIT_DERIVATION_FRAGMENT
    })
    return cached?.derivedFrom ?? null
}

/** The derivations of these units go stale when a link between them changes: drop them, to be read again */
export const evictDerivations = (cache, unitIds) => {
    for (const unitId of new Set([...unitIds].filter(Boolean).map(String))) {
        const id = cache.identify({ __typename: 'Unit', id: unitId })
        cache.evict({ id, fieldName: 'derivedFrom' })
        cache.evict({ id, fieldName: 'derivatives' })
    }
    cache.gc()
}

const failure = (error, fallback) => ({
    status: 'ERROR',
    errors: [{ message: error?.graphQLErrors?.map((e) => e.message).join(', ') || error?.message || fallback }]
})

/**
 * Derives a unit from each of the units, by id or an arrival's ({ unitIds } or { arrival }): under parentIds, or each
 * the root of a unit graph at the position. The units derived from are left as they are. The units created come back;
 * the lists of units by location, and what their sources had derived from them, are read again.
 */
export function useDeriveUnits() {
    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const { mutate: deriveUnitsMutation, loading: deriveUnitsLoading } = useMutation(DERIVE_UNITS_MUTATION)

    const deriveUnits = async ({
        units, parentIds, position, subjectId, stage, description, germplasmId, copyGermplasm = true, controlTeamId, release
    }) => {
        try {
            const response = await deriveUnitsMutation({
                units,
                parentIds: parentIds?.length ? parentIds : null,
                position: position ?? null,
                subjectId: subjectId || null,
                stage: stage || 'UNKNOWN',
                description: description || null,
                germplasmId: germplasmId || null,
                copyGermplasm,
                controlTeamId: toValue(controlTeamId),
                release: toValue(release)
            })
            const payload = response?.data?.unitsDeriveUnits
            if (!payload) return { status: 'ERROR', errors: [{ message: 'Deriving the units returned no data.' }] }
            const derived = payload.result ?? []
            if (payload.status === 'SUCCESS') {
                evictUnitsByLocation(client.cache)
                // the parents list them among their children, and the sources among their derivatives
                const sourceIds = derived.flatMap((unit) => unit.derivedFrom.map((derivation) => derivation.unit.id))
                evictDerivations(client.cache, sourceIds)
                for (const parentId of parentIds ?? []) {
                    client.cache.evict({ id: client.cache.identify({ __typename: 'Unit', id: parentId }), fieldName: 'children' })
                }
                client.cache.gc()
            }
            return { status: payload.status, errors: payload.errors, units: derived }
        } catch (error) {
            return failure(error, 'Failed to derive the units.')
        }
    }

    return { deriveUnits, deriveUnitsLoading }
}
