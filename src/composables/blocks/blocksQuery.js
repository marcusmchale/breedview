import { toValue } from 'vue'
import { useQuery, useApolloClient } from "@vue/apollo-composable";

import BLOCKS_QUERY from '@/graphql/blocks/blocks.graphql'
import UNITS_QUERY from '@/graphql/blocks/units.graphql'

import {computed} from "vue";

export function useBlocksQuery({locationIds}) {

    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const blocksEnabled = computed(() => {
        return toValue(locationIds) !== null && toValue(locationIds) !== undefined && toValue(locationIds).length > 0
    })

    // Fetch root units (blocks) for location
    const {
        result: blocksResult,
        loading: blocksLoading,
        onResult: onBlocksResult,
        error: blocksError,
        refetch: refetchBlocks
    } = useQuery(
        BLOCKS_QUERY,
        () => ({'locationIds': toValue(locationIds)}),
        { enabled: blocksEnabled }
    )

    const blocks = computed(() => {
        if (!blocksEnabled.value) return []
        if (!blocksResult.value) {
            return []
        }
        const blocks = [...blocksResult.value.unitsRoots.result]
        blocks.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
        return blocks
    })

    onBlocksResult((result) => {
        updateCachedLocationBlocks(result)
    })

    const updateCachedLocationBlocks = (result) => {
        if (result?.data?.unitsRoots?.status !== "SUCCESS") return
        if (result?.data?.unitsRoots?.result) {
            client.cache.writeQuery({
                query: UNITS_QUERY,
                variables: {unitIds: result.data.unitsRoots.result.map(unit => unit.id)},
                data: {
                    unitsUnits: {
                        __typename: "UnitsPayload",
                        status: result.data.unitsRoots.status,
                        result: result.data.unitsRoots.result,
                        errors: result.data.unitsRoots.errors
                    }
                }
            })
        }
    }

    return {
        blocks,
        blocksLoading,
        blocksError,
        refetchBlocks
    }
}