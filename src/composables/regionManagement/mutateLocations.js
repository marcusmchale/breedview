import { ref, computed } from 'vue'
import { useLazyQuery, useMutation, useApolloClient } from '@vue/apollo-composable'

import DELETE_LOCATION_MUTATION from '@/graphql/regions/deleteLocation.graphql'
import UPDATE_LOCATION_MUTATION from '@/graphql/regions/updateLocation.graphql'
import CREATE_LOCATION_MUTATION from '@/graphql/regions/createLocation.graphql'
import LOCATION_FRAGMENT from '@/graphql/regions/locationFragment.graphql'
import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useMutateLocations() {
    const { client } = useApolloClient()

    // force a reload, use when the data is cached but stale,
    // so far this is really only when we reload a parent location to get a new child that was added
    // for the other cases we can update the cache manually
    //const reloadLocations = async (locationIds) => {
    //
    //    await client.query({
    //        query: LOCATIONS_QUERY,
    //        variables: { locationIds: unique },
    //        fetchPolicy: "network-only"
    //    })
    //}

    const reloadLocationIds = ref(null)
    const reloadVariables = computed( () => {
        return { locationIds: reloadLocationIds.value }
    })
    const {
        load: loadLocations,
        refetch: refetchLocations
    } = useLazyQuery(
        LOCATIONS_QUERY,
        reloadVariables,
        {fetchPolicy: "cache-and-network"}
    )

    const reloadLocations = (locationIds) => {
        let unique = [...new Set(locationIds)].filter(Boolean)
        if (unique.length === 0) return
        reloadLocationIds.value = unique
        loadLocations() || refetchLocations()
    }

    // Create a location and load it to the cache, return status and errors
    const {
        mutate: createLocationMutation,
        loading: createLocationLoading,
    } = useMutation(CREATE_LOCATION_MUTATION)

    const createLocation = async (locationData) => {
        const response = await createLocationMutation({location: locationData})

        if (response?.data?.regionsCreateLocation) {
          const result = response.data.regionsCreateLocation
          if (result.status === 'SUCCESS') {
              await reloadLocations([locationData.parentId])
          }
          const { status, errors } = result
          return { status, errors }
        }
    }

    // Update a location and reload the cache, return status and errors
    const {
        mutate: updateLocationMutation,
        loading: updateLocationLoading,
    } = useMutation(UPDATE_LOCATION_MUTATION)


    const removeChildFromParentInCache = ({oldParentId, childId}) => {
        const cachedOldParentData = client.cache.readFragment({
            id: `Location:${oldParentId}`,
            fragment: LOCATION_FRAGMENT
        })
        console.log('old parent cached data:', cachedOldParentData)
        if (cachedOldParentData?.children) {
            const oldParentCacheId = client.cache.identify({
                __typename: "Location",
                id: oldParentId
            })
            console.log('old parent cache Id', oldParentCacheId)
            const childCacheId = client.cache.identify({
                __typename: "Location",
                id: childId
            })
            console.log('child cache id', childCacheId)
            client.cache.modify({
                id: oldParentCacheId,
                fields: {
                    children(existingChildren = []) {
                        return existingChildren.filter(
                            ref => ref.__ref !== childCacheId
                        );
                    }
                }
            })
        }
    }

    const addChildToParentInCache = ({newParentId, childId}) => {
        // now update the new parent in the cache
        const newParentCacheId = client.cache.identify({
            __typename: "Location",
            id: newParentId
        })
        const childCacheId = client.cache.identify({
            __typename: "Location",
            id: childId
        })
        client.cache.modify({
            id: newParentCacheId,
            fields: {
                children(existingChildren = []) {
                    return [...existingChildren.filter(ref => ref.__ref !== childCacheId),  {__ref: childCacheId}];
                }
            }
        })
    }

    const updateParentRef = ({childId, parentId}) => {
        const newParentCacheId = client.cache.identify({
            __typename: "Location",
            id: parentId
        })
        const childCacheId = client.cache.identify({
            __typename: "Location",
            id: childId
        })
        client.cache.modify({
            id: childCacheId,
            fields: {
                parent() {
                    return {__ref: newParentCacheId};
                }
            }
        })
    }

    const updateLocation = async (locationData) => {
        const response = await updateLocationMutation({location: locationData})
        if (response?.data?.regionsUpdateLocation) {
            const result = response.data.regionsUpdateLocation
            if (result.status === 'SUCCESS') {
                // Convert field values to modifier functions
                const fieldModifiers = {};
                for (const key in locationData) {
                    if (locationData[key] !== undefined && key !== 'locationId') {
                        fieldModifiers[key] = () => locationData[key];
                    }
                }
                const locationCacheId = client.cache.identify({
                    __typename: "Location",
                    id: locationData.locationId
                })
                const cachedData = client.cache.readFragment({
                    id: locationCacheId,
                    fragment: LOCATION_FRAGMENT
                })
                const oldParentId = cachedData?.parent?.id
                console.log('old parent Id to remove this node from its children', oldParentId)
                client.cache.modify({
                    id: locationCacheId,
                    fields: fieldModifiers,
                });

                // now update the children list in old parent if we have a new parentId
                if (locationData.parentId && locationData.parentId !== oldParentId) {
                    removeChildFromParentInCache({
                        oldParentId:oldParentId,
                        childId: locationData.locationId
                    })
                    addChildToParentInCache({
                        newParentId: locationData.parentId,
                        childId: locationData.locationId
                    })
                    updateParentRef({
                        parentId: locationData.parentId,
                        childId: locationData.locationId
                    })
                }
            }
            const { status, errors} = result
            return { status, errors}
        }
    }


    // Delete a location
    const {
        mutate: deleteLocationMutation,
        loading: deleteLocationLoading,
    } = useMutation(DELETE_LOCATION_MUTATION)

    const deleteLocation = async (locationId) => {
        const response = await deleteLocationMutation({
            locationId: locationId
        })
        if (response?.data?.regionsDeleteLocation) {
            const result = response.data.regionsDeleteLocation

            if (result.status === 'SUCCESS') {
                const cachedData = client.cache.readFragment({
                    id: `Location:${locationId}`,
                    fragment: LOCATION_FRAGMENT
                })
                const locationCacheId = client.cache.identify({
                    __typename: "Location",
                    id: locationId
                })
                if (cachedData?.parent?.id) {
                    removeChildFromParentInCache({
                        oldParentId: cachedData.parent?.id,
                        childCacheId: locationCacheId
                    })
                }
                client.cache.evict({ id: locationCacheId})
                client.cache.gc()
            }
            const {status, errors} = result
            return {status, errors}
        }
    }

    return {
        createLocation,
        createLocationLoading,

        updateLocation,
        updateLocationLoading,

        deleteLocation,
        deleteLocationLoading
    }

}

