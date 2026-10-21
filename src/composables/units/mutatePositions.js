import { toValue } from "vue";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates"
import { evictUnitsByLocation } from "@/composables/units/unitPlaces"

import UNIT_FRAGMENT from '@/graphql/units/unitFragment.graphql'
import ADD_POSITION_MUTATION from '@/graphql/units/addPosition.graphql'
import REMOVE_POSITION_MUTATION from '@/graphql/units/removePosition.graphql'
import MOVE_UNITS_MUTATION from '@/graphql/units/moveUnits.graphql'
import CHANGE_POSITIONS_MUTATION from '@/graphql/units/changePositions.graphql'

import { useApolloClient, useMutation } from '@vue/apollo-composable'

export function useMutatePositions({ unitId }) {

    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const {
        addPosition: addPositionToCache,
        removePosition: removePositionFromCache
    } = useCacheUpdates({typename: "Unit", fragment: UNIT_FRAGMENT})

    const {
        mutate: addPositionMutation,
        loading: addPositionLoading,
        error: addPositionError
    } = useMutation(ADD_POSITION_MUTATION)

    const addPosition = async (position) => {
        const { location, layout, coordinates, start, end } = position
        const positionData = {
            locationId: location.id,
            layoutId: layout?.id ?? null,
            coordinates,
            start,
            end
        }
        const response = await addPositionMutation({ unitId: toValue(unitId), position: positionData })
        if (response?.data?.unitsAddPosition) {
            const result = response.data.unitsAddPosition
            if (result.status === "SUCCESS") {
                addPositionToCache({
                    unitId: toValue(unitId),
                    position: position
                })
                evictUnitsByLocation(client.cache)
            }
            const { status, errors } = result
            return { status, errors }
        }
        return { status: 'ERROR', errors: [{ message: 'Adding the position returned no data.' }] }
    }

    const {
        mutate: removePositionMutation,
        loading: removePositionLoading,
        error: removePositionError
    } = useMutation(REMOVE_POSITION_MUTATION)

    const removePosition = async (position) => {

        const {location, layout, coordinates, start, end } = position

        const positionData = {
            locationId: location.id,
            layoutId: layout?.id ?? null,
            coordinates,
            start,
            end
        }
        const response = await removePositionMutation({unitId: toValue(unitId), position: positionData})

        if (response?.data?.unitsRemovePosition) {
            const result = response.data.unitsRemovePosition
            if (result.status === "SUCCESS") {
                removePositionFromCache({
                    unitId: toValue(unitId),
                    position: position
                })
                evictUnitsByLocation(client.cache)
            }
            const { status, errors } = result
            return { status, errors }
        }
        return { status: 'ERROR', errors: [{ message: 'Removing the position returned no data.' }] }
    }


    return {
        addPosition, addPositionLoading, addPositionError,
        removePosition, removePositionLoading, removePositionError
    }
}

/** A position as the API lists it, as the values that find it again: every field, as entered */
export const positionMatch = (position) => ({
    locationId: position.location.id,
    layoutId: position.layout?.id ?? null,
    coordinates: position.coordinates?.length ? position.coordinates : null,
    start: position.start ?? null,
    end: position.end ?? null
})

const failure = (error, fallback) => ({
    status: 'ERROR',
    errors: [{ message: error?.graphQLErrors?.map((e) => e.message).join(', ') || error?.message || fallback }]
})

/**
 * Writes to the positions of many units at once, by id or an arrival's ({ unitIds } or { arrival }): a move to a
 * position from its start, and a change to one position of each, found by at. The units written come back with their
 * positions, which updates them in the cache; the lists of units by location are read again.
 */
export function useMoveUnits() {
    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const { mutate: moveUnitsMutation, loading: moveUnitsLoading } = useMutation(MOVE_UNITS_MUTATION)
    const { mutate: changePositionsMutation, loading: changePositionsLoading } = useMutation(CHANGE_POSITIONS_MUTATION)

    const written = (payload, fallback) => {
        if (!payload) return { status: 'ERROR', errors: [{ message: fallback }] }
        if (payload.status === 'SUCCESS') evictUnitsByLocation(client.cache)
        return { status: payload.status, errors: payload.errors, units: payload.result ?? [] }
    }

    const moveUnits = async ({ units, position }) => {
        try {
            const response = await moveUnitsMutation({ units, position })
            return written(response?.data?.unitsMoveUnits, 'Moving the units returned no data.')
        } catch (error) {
            return failure(error, 'Failed to move the units.')
        }
    }

    const changePositions = async ({ units, at, change }) => {
        try {
            const response = await changePositionsMutation({ units, at, change })
            return written(response?.data?.unitsChangePositions, 'Changing the positions returned no data.')
        } catch (error) {
            return failure(error, 'Failed to change the positions.')
        }
    }

    return { moveUnits, moveUnitsLoading, changePositions, changePositionsLoading }
}
