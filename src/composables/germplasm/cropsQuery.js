import { computed} from "vue";
import {useApolloClient, useQuery} from "@vue/apollo-composable"

import CROPS_QUERY from '@/graphql/germplasm/crops.graphql'
import ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'

export function useCropsQuery(){

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const {
        result: cropsResult,
        loading: cropsLoading,
        onResult: onCropsResult,
        error: cropsError,
        refetch: refetchCrops
    } = useQuery(CROPS_QUERY)

    const crops = computed(() => {
        if (!cropsResult.value) {
            return []
        }
        const crops = [...cropsResult.value.germplasmCrops.result]
        crops.sort((a, b) => a?.name.localeCompare(b?.name))
        return crops
    })

    onCropsResult((result) => {
        updateCachedGermplasmCrops(result)
    })

    const updateCachedGermplasmCrops = (result) => {
        if (result?.data?.germplasmCrops?.status !== "SUCCESS") return
        if (result?.data?.germplasmCrops?.result) {
            client.cache.writeQuery( {
                query: ENTRIES_QUERY,
                variables: {entryIds: result.data.germplasmCrops.result.map(entry => entry.id), names: null},
                data: {
                    germplasmEntries: {
                        __typename: "GermplasmEntriesPayload",
                        status: result.data.germplasmCrops.status,
                        result: result.data.germplasmCrops.result,
                        errors: result.data.germplasmCrops.errors
                    }
                }
            })
        }
    }

    return {
        crops,
        cropsLoading,
        cropsError,
        refetchCrops
    }
}