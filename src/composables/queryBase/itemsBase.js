import { computed, toValue } from 'vue'
import { useQuery } from "@vue/apollo-composable";

export function useItemsQuery({
    itemIds,
    itemsQueryGraphql,
    queryName,
    variableName
}) {

    const enabled = computed(() => {
        const ids = toValue(itemIds)
        return Array.isArray(ids) && ids.length > 0 && ids.every(id => id != null)
    })

    const variables = computed( () => ({
       [variableName]: toValue(itemIds).filter(Boolean)
    }))

    const {
        result: itemsResult,
        loading: itemsLoading,
        error: itemsError,
    } = useQuery(
        itemsQueryGraphql,
        variables,
        { enabled: enabled }
    )

    const items = computed(() => {
        if (toValue(itemIds).length > 0) {
            const result = itemsResult.value?.[queryName]?.result || []
            const items = [...result]
            items.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
            return items
        } else {
            return []
        }
    })

    return {
        items,
        itemsLoading,
        itemsError
    }
}