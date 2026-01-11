import {ref, computed, toValue} from 'vue'
import { useLazyQuery, useApolloClient } from "@vue/apollo-composable";


export function useItemsLazyQuery({
    itemsQueryGraphql,
    itemQueryFragment,
    queryName,
    variableName,
    typeName
}) {

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const itemIds = ref([])
    const variables = computed( () => ({
       [variableName]: toValue(itemIds)
    }))

    const {
        result: itemsResult,
        load: loadItems,
        loading: itemsLoading,
        error: itemsError

    } = useLazyQuery(
        itemsQueryGraphql,
        variables
    )

    const items = computed(() => {
        const result = itemsResult.value?.[queryName]?.result || []
        const items = [...result]
        items.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
        return items
    })

    // Assumes the item is already loaded to the cache
    // Get its children ids from the cache and load them
    const loadChildren = (itemId) => {
        const cachedItem = client.cache.readFragment({
            id: `${typeName}:${itemId}`,
            fragment: itemQueryFragment
        })
        if (cachedItem?.children && cachedItem?.children?.length > 0) {
            itemIds.value = cachedItem.children.map(child => child.id)
        }
        loadItems()
    }

    return {
        items,
        itemsLoading,
        itemsError,

        loadItems,
        loadChildren
    }
}