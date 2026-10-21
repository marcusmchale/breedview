import { toValue } from "vue";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates"

import UNIT_FRAGMENT from '@/graphql/units/unitFragment.graphql'
import ADD_POSITION_MUTATION from '@/graphql/units/addPosition.graphql'
import REMOVE_POSITION_MUTATION from '@/graphql/units/removePosition.graphql'

import { useMutation } from '@vue/apollo-composable'

export function useMutatePositions({ unitId }) {

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