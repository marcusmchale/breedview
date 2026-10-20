import { computed, toValue } from 'vue'
import { useQuery } from "@vue/apollo-composable";

export function useItemQuery({
     itemId,
     itemsQueryGraphql,
     queryName,
     variableName
}) {

    const enabled = computed(() => {
        const id = toValue(itemId)
        return id !== null && id !== undefined
    })

    const variables = computed( () => ({
       [variableName]: toValue(itemId)
    }))

    const {
        result: itemsResult,
        loading: itemLoading,
        error: itemError,
        refetch: refetchItem
    } = useQuery(
        itemsQueryGraphql,
        variables,
        { enabled: enabled }
    )

    // A disabled query keeps its last result, so a cleared id would still show the old item
    const item = computed(() => {
        if (!enabled.value) return null
        const result = itemsResult.value?.[queryName]?.result
        return result && result.length > 0 ? result[0] : null
    })

    return {
        item,
        itemLoading,
        itemError,
        refetchItem
    }
}