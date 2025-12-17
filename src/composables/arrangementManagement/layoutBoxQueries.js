import { ref } from 'vue'
import { useLazyQuery, useApolloClient } from '@vue/apollo-composable'

import ARRANGEMENTS_QUERY from '@/graphql/arrangements/arrangements.graphql'
import LAYOUTS_QUERY from '@/graphql/arrangements/layouts.graphql'
//import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useQueryLayouts(layoutCache) {
    const { client } = useApolloClient()

    const {
        setLayout
    } = layoutCache

    // Fetch root layouts (arrangement) for a given location
    const arrangementsQueryVariables = ref({
        locationId: null
    })

    // Fetch arrangements for location
    const {
        load: loadArrangements,
        loading: arrangementsLoading,
        error: arrangementsError,
        onResult: onArrangementsResult,
        refetch: refetchArrangements
    } = useLazyQuery(
        ARRANGEMENTS_QUERY,
        () => arrangementsQueryVariables.value
    )

    onArrangementsResult((result) => {
        const arrangements = result?.data?.arrangements?.result || []
        arrangements.forEach(layout => setLayout(layout.id, layout))
    })

    const loadLocationArrangements = (locationId) => {
        if (!locationId) return
        arrangementsQueryVariables.value = {
            locationId: locationId
        }
        loadArrangements() || refetchArrangements()
    }

    const reloadLocationArrangements = async (locationId) => {
        if (!locationId) return
        const result = await client.query({
            query: ARRANGEMENTS_QUERY,
            variables: {locationId: locationId},
            fetchPolicy: "network-only"
        })
        const arrangements = result.data?.arrangements?.result || []
        arrangements.forEach(layout => setLayout(layout.id, layout))
    }

    // Fetch layouts by ID
    const layoutQueryVariables = ref({
        layoutIds: []
    })

    const {
        load: loadLayoutsByIds,
        loading: layoutsLoading,
        error: layoutsError,
        onResult: onLayoutsResult,
        refetch: refetchLayoutsByIds
    } = useLazyQuery(
      LAYOUTS_QUERY,
      () => layoutQueryVariables.value
    )

    onLayoutsResult((result) => {
        const layouts = result.data?.arrangementsLayouts?.result || []
        layouts.forEach(layout => setLayout(layout.id, layout))
    })

    const loadLayouts = (layoutIds) => {
        let unique = [...new Set(layoutIds)].filter(Boolean)
        if (!unique) return

        layoutQueryVariables.value = { layoutIds: unique}
        loadLayoutsByIds() || refetchLayoutsByIds()
    }

    const reloadLayouts = async (layoutIds) => {
        let unique = [...new Set(layoutIds)].filter(Boolean)
        if (!unique) return

        const result = await client.query({
            query: LAYOUTS_QUERY,
            variables: { layoutIds: unique },
            fetchPolicy: "network-only"
        })

        const layouts = result.data?.arrangementsLayouts?.result || [];
        layouts.forEach(layout => setLayout(layout.id, layout))
    }

    return {
        loadLocationArrangements,
        reloadLocationArrangements,
        arrangementsLoading,
        arrangementsError,

        loadLayouts,
        reloadLayouts,
        layoutsLoading,
        layoutsError
    }
}