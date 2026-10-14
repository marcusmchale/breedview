import {ref, computed, toValue} from 'vue'
import { useLazyQuery, useApolloClient } from "@vue/apollo-composable";
import { gql } from '@apollo/client/core'

/** Fragment with only the child ids of a hierarchical type, for reading what to load next from the cache. */
const childIdsFragment = (typeName) => gql`
  fragment ${typeName}ChildIds on ${typeName} {
    children { id }
  }
`


export function useItemsLazyQuery({
    itemsQueryGraphql,
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

    // Assumes the item is already loaded to the cache, if only with its child ids (a tree walk loads no more).
    // Get its children ids from the cache and load them.
    // Returns what the lazy query's load returns: a promise of the result, or false when it has already run
    const loadChildren = (itemId) => {
        const cachedItem = client.cache.readFragment({
            id: `${typeName}:${itemId}`,
            fragment: childIdsFragment(typeName)
        })
        itemIds.value = (cachedItem?.children ?? []).map(child => child.id)
        return loadItems()
    }

    return {
        items,
        itemsLoading,
        itemsError,

        loadItems,
        loadChildren
    }
}