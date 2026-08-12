import { ref, computed, toValue } from 'vue'
import { useLazyQuery, useMutation } from '@vue/apollo-composable'

import { useCurrentVersionQuery } from "@/composables/ontology/currentVersion";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";

import LAYOUTS_QUERY from '@/graphql/arrangements/layouts.graphql'
import LAYOUT_FRAGMENT from '@/graphql/arrangements/layoutFragment.graphql'
import CREATE_LAYOUT_MUTATION from '@/graphql/arrangements/createLayout.graphql'
import UPDATE_LAYOUT_MUTATION from '@/graphql/arrangements/updateLayout.graphql'
import DELETE_LAYOUT_MUTATION from '@/graphql/arrangements/deleteLayout.graphql'


export function useMutateLayouts() {

    const { version: ontologyVersion } = useCurrentVersionQuery()
    const ontologyVersionId = computed(() => ontologyVersion.value?.id )

    const { updateCache, deleteFromCache } = useCacheUpdates({
        typename: "Layout",
        fragment: LAYOUT_FRAGMENT,
        ontologyVersionId: ontologyVersionId,
        ontologyView: "PUBLISHED"
    })
   
    const loadLayoutIds = ref(null)
    const {
        load: loadLayouts,
        refetch: refetchLayouts
    } = useLazyQuery(
        LAYOUTS_QUERY,
        () => ({ 'layoutIds': loadLayoutIds.value }),
        { fetchPolicy: "cache-and-network"}
    )

    const reloadLayouts = (layoutIds) => {
        let unique = [...new Set(layoutIds)].filter(Boolean)
        if (unique.length === 0) return
        loadLayoutIds.value = unique
        loadLayouts() || refetchLayouts()
    }

    // Create a layout and load it to the cache, return status and errors
    const {
        mutate: createLayoutMutation,
        loading: createLayoutLoading,
        error: createLayoutError
    } = useMutation(CREATE_LAYOUT_MUTATION)

    const createLayout = async ( { layoutData, controlTeamId, release } ) => {
        const response = await createLayoutMutation({
            layout: layoutData,
            controlTeamId: toValue(controlTeamId),
            release: toValue(release)
        })

        if (response?.data?.arrangementsCreateLayout) {
            const result = response.data.arrangementsCreateLayout
            if (result.status === 'SUCCESS') {
                reloadLayouts([layoutData.parentId])
            }
            const { status, errors } = result
            return { status, errors }
        }
    }

    // Update a layout
    const {
        mutate: updateLayoutMutation,
        loading: updateLayoutLoading,
        error: updateLayoutError
    } = useMutation(UPDATE_LAYOUT_MUTATION)


    const updateLayout = async (layoutData) => {
        const response = await updateLayoutMutation({layout: layoutData})
        if (response?.data?.arrangementsUpdateLayout) {
            const result = response.data.arrangementsUpdateLayout
            if (result.status === 'SUCCESS') {
                updateCache(layoutData)
            }
            const { status, errors} = result
            return { status, errors}
        }
    }

    // Delete a layout
    const {
        mutate: deleteLayoutMutation,
        loading: deleteLayoutLoading,
        error: deleteLayoutError
    } = useMutation(DELETE_LAYOUT_MUTATION)

    const deleteLayout = async (layoutId) => {
        const response = await deleteLayoutMutation({
            layoutId: layoutId
        })
        if (response?.data?.arrangementsDeleteLayout) {
            const result = response.data.arrangementsDeleteLayout
            if (result.status === 'SUCCESS') {
                deleteFromCache({id: layoutId})
            }
            const {status, errors} = result
            return {status, errors}
        }
    }

    return {
        createLayout,
        createLayoutLoading,
        createLayoutError,

        updateLayout,
        updateLayoutLoading,
        updateLayoutError,

        deleteLayout,
        deleteLayoutLoading,
        deleteLayoutError
    }

}
