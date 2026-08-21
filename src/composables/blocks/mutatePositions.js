import { toValue } from "vue";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates"

import UNIT_FRAGMENT from '@/graphql/blocks/unitFragment.graphql'
import ADD_POSITION_MUTATION from '@/graphql/blocks/addPosition.graphql'
import REMOVE_POSITION_MUTATION from '@/graphql/blocks/removePosition.graphql'

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
        if (response?.data?.blocksAddPosition) {
            const result = response.data.blocksAddPosition
            if (result.status === "SUCCESS") {
                addPositionToCache({
                    unitId: unitId,
                    position: position
                })
            }
            const { status, errors } = result
            return { status, errors }
        }
    }

    const {
        mutate: removePositionMutation,
        loading: removePositionLoading,
        error: removePositionError
    } = useMutation(REMOVE_POSITION_MUTATION)

    const removePosition = async (position) => {

        const {location, layout, coordinates, start, end } = position

        const positionData = {
            locationId:location.id,
            layoutId:layout?.id,
            coordinates,
            start,
            end
        }
        const response = await removePositionMutation({unitId: toValue(unitId), position: positionData})

        if (response?.data?.blocksRemovePosition) {
            const result = response.data.blocksRemovePosition
            if (result.status === "SUCCESS") {
                removePositionFromCache({
                    unitId: toValue(unitId),
                    position: position
                })
            }
            const { status, errors } = result
            return { status, errors }
        }
    }


    return {
        addPosition, addPositionLoading, addPositionError,
        removePosition, removePositionLoading, removePositionError
    }
}