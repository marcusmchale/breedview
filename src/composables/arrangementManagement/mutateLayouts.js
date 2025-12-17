import { useMutation, useApolloClient } from '@vue/apollo-composable'

import CREATE_LAYOUT_MUTATION from '@/graphql/arrangements/createLayout.graphql'
import UPDATE_LAYOUT_MUTATION from '@/graphql/arrangements/updateLayout.graphql'
import DELETE_LAYOUT_MUTATION from '@/graphql/arrangements/deleteLayout.graphql'


export function useMutateLayouts(layoutCache, queryLayouts) {
    const { client } = useApolloClient()

    const {
        get: getLayout,
        remove: removeLayout
    } = layoutCache

    const {
        reloadLayouts,
    } = queryLayouts

    // Create a layout and load it to the cache, return status and errors
    const {
        mutate: createLayoutMutation,
        loading: createLayoutLoading
    } = useMutation(CREATE_LAYOUT_MUTATION)

    const createLayout = async (layoutData) => {
        const response = await createLayoutMutation({layout: layoutData})

        if (response?.data?.arrangementsCreateLayout) {
            const result = response.data.arrangementsCreateLayout
            if (result.status === 'SUCCESS') {
                await reloadLayouts([layoutData.parentId])
            }
            const { status, errors } = result
            return { status, errors }
        }
    }

    // Update an existing layout
    const {
        mutate: updateLayoutMutation,
        loading: updateLayoutLoading
    } = useMutation(UPDATE_LAYOUT_MUTATION)

    const updateLayout = async (layoutData) => {
        const response = await updateLayoutMutation({layout: layoutData})
        if (response?.data?.arrangementsUpdateLayout) {
            const result = response.data.arrangementsUpdateLayout
            if (result.status === 'SUCCESS') {
                const cachedLayoutRef = getLayout(layoutData.layoutId)
                const layoutCacheId = client.cache.identify({
                    __typename: "Layout",
                    id: layoutData.layoutId
                })

                const fieldsToUpdate = {}
                for (const key in layoutData) {
                    if (layoutData[key] !== undefined) {
                        fieldsToUpdate[key] = () => layoutData[key]
                    }
                }
                
                if (layoutData.parentId) {
                    if (layoutData.parentId !== cachedLayoutRef.value?.parent?.id) {
                        // todo this code is basically the same in location cache, consider a helper before duplicating elsewhere
                        const newParentCacheId = client.cache.identify({
                            __typename: "Layout",
                            id: layoutData.parentId
                        })
                        fieldsToUpdate.parent = () => ({__ref: newParentCacheId});

                        const oldParentRef = getLayout(cachedLayoutRef.value.parent.id)
                        if (oldParentRef.value) {
                            oldParentRef.value.children = oldParentRef.value.children.filter(
                                child => child.id !== layoutData.layoutId
                            )
                            const oldParentCacheId = client.cache.identify({
                                __typename: "Layout",
                                id: oldParentRef.value.id
                            })
                            client.cache.modify({
                                id: oldParentCacheId,
                                fields: {
                                    children(existingChildren = []) {
                                        return existingChildren.filter(
                                            ref => ref.__ref !== layoutCacheId
                                        );
                                    }
                                }
                            });
                        }

                        const newParentRef = getLayout(layoutData.parentId)
                        if (newParentRef.value) {
                            newParentRef.value.children = [
                                ...newParentRef.value.children,
                                {__typename: "Layout", id: layoutData.layoutId}
                            ]
                            client.cache.modify({
                                id: newParentCacheId,
                                fields: {
                                    children(existingChildren = []) {
                                        //if (existingChildren.some(ref => ref.__ref === layoutCacheId)) return existingChildren;
                                        return [...existingChildren, {__ref: layoutCacheId}];
                                    }
                                }
                            });
                        }
                    }
                    
                    //todo use this basic logic for unit cache where we have parents, i mistakenly wrote it for layouts which have singular parent
                    //fieldsToUpdate.parents = layoutData.parentIds.map(
                    //    parentId => client.cache.identify({ __typename: "Layout", id: parentId })
                    //) //todo check if parentIDs should be removed from fields to update
                    //
                    //const oldParentIds = new Set(cachedLayoutRef.value.parents.map(layout => layout.id))
                    //const newParentIds = new Set(layoutData.parentIds)
                    //const toRemove = [oldParentIds - newParentIds]
                    //toRemove.forEach(parentId => {
                    //    const oldParentRef = getLayout(parentId)
                    //    oldParentRef.value.children = oldParentRef.value.children.filter(layout => {
                    //        layout.id !== layoutData.id
                    //    })
                    //    const oldParentCacheId = client.cache.identify({
                    //        __typename: "Layout",
                    //        id: parentId
                    //    })
                    //    client.cache.modify({
                    //        id: oldParentCacheId,
                    //        fields: {
                    //            children(existingChildren = []) {
                    //                return existingChildren.filter(
                    //                    ref => ref.__ref !== layoutCacheId
                    //                )
                    //            }
                    //        }
                    //    })
                    //})
                    //const toAdd = [newParentIds - oldParentIds]
                    //toAdd.forEach(parentId => {
                    //    const newParentRef = getLayout(parentId)
                    //    newParentRef.value.children = [
                    //        ...newParentRef.value.children,
                    //        {__typename:"Layout", id: layoutData.layoutId}
                    //    ]
                    //    const newParentCacheId = client.cache.identify({ __typename: "Layout", id: parentId })
                    //
                    //    fieldsToUpdate.parents = () => ({ __ref: newParentCacheId });
                    //
                    //    client.cache.modify({
                    //        id: newParentCacheId,
                    //        fields: {
                    //            children(existingChildren = []) {
                    //                return [...existingChildren, { __ref: layoutCacheId }];
                    //            }
                    //        }
                    //    })
                    //})
                }
                //await reloadLayouts([layoutData.layoutId, layoutData.parentId, cachedLayout.parent?.id])

                if (layoutData.typeId) {
                    const typeCacheId = client.cache.identify({
                        __typename: "LayoutType",
                        id: layoutData.typeId
                    })
                    fieldsToUpdate.type = () => ({ __ref: typeCacheId });
                }

                if (layoutData.axes) {
                    cachedLayoutRef.value.axes = layoutData.axes
                }

                if (layoutData.position) {
                    cachedLayoutRef.value.position = layoutData.position
                }

            }
            const { status, errors} = result
            return { status, errors}
        }
    }

    // Delete a layout
    const {
        mutate: deleteLayoutMutation,
        loading: deleteLayoutLoading
    } = useMutation(DELETE_LAYOUT_MUTATION)

    const deleteLayout = async (layoutId) => {
        const response = await deleteLayoutMutation({
            layoutId: layoutId
        })
        if (response?.data?.arrangementsDeleteLayout) {
            const result = response.data.arrangementsDeleteLayout

            if (result.status === 'SUCCESS') {
                const layoutRef = getLayout(layoutId)
                const layoutCacheId = client.cache.identify({
                    __typename: "Layout",
                    id: layoutId
                })

                const parentId = layoutRef.value?.parent?.id
                if (parentId) {
                      const oldParentRef = getLayout(parentId)
                      oldParentRef.value.children = oldParentRef.value.children.filter(
                          child => child.id !== layoutId
                      )
                      const oldParentCacheId = client.cache.identify({
                          __typename: "Layout",
                          id: parentId
                      });
                      client.cache.modify({
                          id: oldParentCacheId,
                          fields: {
                              children(existingChildren = []) {
                                  return existingChildren.filter(ref => ref.__ref !== layoutCacheId);
                              }
                          }
                      })
                }
                // todo as above, use for units, better yet, bring together these calls into a helper
                //const parentIds = layoutRef.value?.parents.map(layout => layout.id) || []
                //if (parentIds.length > 0) {
                //    parentIds.forEach(parentId => {
                //        const oldParentRef = getLayout(parentId)
                //        oldParentRef.value.children = oldParentRef.value.children.filter(
                //            child => child.id !== layoutId
                //        )
                //        const oldParentCacheId = client.cache.identify({
                //            __typename: "Layout",
                //            id: layoutId
                //        })
                //        client.cache.modify({
                //            id: oldParentCacheId,
                //            field: {
                //                children(existingChildren = []){
                //                    return existingChildren.filter(ref => ref.__ref !== layoutCacheId)
                //                }
                //            }
                //        })
                //    })
                //}
                client.cache.evict({ id: layoutCacheId})
                client.cache.gc()
                await removeLayout(layoutId)
            }
            const {status, errors} = result
            return {status, errors}
        }
    }

    return {
        createLayout,
        createLayoutLoading,

        updateLayout,
        updateLayoutLoading,

        deleteLayout,
        deleteLayoutLoading

    }

}
