import {ref, toValue} from 'vue'
import { useApolloClient, useLazyQuery, useMutation } from '@vue/apollo-composable'
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";
import { evictUnitsByLocation } from "@/composables/units/unitPlaces";

import UNITS_QUERY from '@/graphql/units/units.graphql'
import UNIT_FRAGMENT from '@/graphql/units/unitFragment.graphql'
import CREATE_UNIT_MUTATION from '@/graphql/units/createUnit.graphql'
import UPDATE_UNIT_MUTATION from '@/graphql/units/updateUnit.graphql'
import DELETE_UNIT_MUTATION from '@/graphql/units/deleteUnit.graphql'

const extractApolloErrorMessage = (error, fallbackMessage) => {
    const messages = []

    const pushMessage = (value) => {
        if (!value) return
        const message = typeof value === 'string' ? value : value.message
        if (message && !messages.includes(message)) {
            messages.push(message)
        }
    }

    if (Array.isArray(error?.graphQLErrors)) {
        error.graphQLErrors.forEach(pushMessage)
    }

    const networkErrors = error?.networkError?.result?.errors
    if (Array.isArray(networkErrors)) {
        networkErrors.forEach(pushMessage)
    }

    pushMessage(error?.networkError?.result?.error)
    pushMessage(error?.cause)
    pushMessage(error?.message)

    return messages.length > 0 ? messages.join(', ') : fallbackMessage
}

export function useMutateUnits() {

    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const { getCached, updateCache, deleteFromCache } = useCacheUpdates({
        typename: "Unit",
        fragment: UNIT_FRAGMENT
    })
   
    const loadUnitIds = ref(null)

    const {
        load: loadUnits,
        refetch: refetchUnits
    } = useLazyQuery(
        UNITS_QUERY,
        () => ({ 'unitIds': loadUnitIds.value }),
        { fetchPolicy: "cache-and-network"}
    )

    const reloadUnits = (unitIds) => {
        let unique = [...new Set(unitIds)].filter(Boolean)
        if (unique.length === 0) return
        loadUnitIds.value = unique
        loadUnits() || refetchUnits()
    }

    // Create a unit and load it to the cache, return status and errors
    const {
        mutate: createUnitMutation,
        loading: createUnitLoading,
        error: createUnitError
    } = useMutation(CREATE_UNIT_MUTATION)

    const createUnit = async ({ unitData, position, controlTeamId, release}) => {
        try {
            const response = await createUnitMutation({
                unit: unitData,
                position: position,
                controlTeamId: toValue(controlTeamId),
                release: toValue(release)
            })

            if (response?.data?.unitsCreateUnit) {
                const result = response.data.unitsCreateUnit
                if (result.status === 'SUCCESS') {
                    // the parents list the new unit among their children; it may be a new unit graph or arrival
                    const parentIds = unitData.parentIds ?? (unitData.parentId ? [unitData.parentId] : [])
                    if (parentIds.length) reloadUnits(parentIds)
                    evictUnitsByLocation(client.cache)
                }
                const { status, errors } = result
                return { status, errors }
            }

            return {
                status: 'ERROR',
                errors: [{ message: 'Create unit mutation returned no data.' }]
            }
        } catch (error) {
            return {
                status: 'ERROR',
                errors: [{ message: extractApolloErrorMessage(error, 'Failed to create unit.') }]
            }
        }
    }

    // Update a unit
    const {
        mutate: updateUnitMutation,
        loading: updateUnitLoading,
        error: updateUnitError
    } = useMutation(UPDATE_UNIT_MUTATION)


    const updateUnit = async (unitData) => {
        try {
            const response = await updateUnitMutation({unit: unitData})
            if (response?.data?.unitsUpdateUnit) {
                const result = response.data.unitsUpdateUnit
                if (result.status === 'SUCCESS') {
                    updateCache(unitData)
                    // a unit given other parents may join or leave an arrival, or become a unit graph's root
                    if (unitData.parentIds || unitData.childrenIds) evictUnitsByLocation(client.cache)
                }
                const { status, errors} = result
                return { status, errors }
            }
            return {
                status: 'ERROR',
                errors: [{ message: 'Update unit mutation returned no data.' }]
            }
        } catch (error) {
            return {
                status: 'ERROR',
                errors: [{ message: extractApolloErrorMessage(error, 'Failed to update unit.') }]
            }
        }
    }

    // Delete a unit
    const {
        mutate: deleteUnitMutation,
        loading: deleteUnitLoading,
        error: deleteUnitError
    } = useMutation(DELETE_UNIT_MUTATION)

    const deleteUnit = async (unitId) => {
        try {
            const response = await deleteUnitMutation({
                unitId: unitId
            })
            if (response?.data?.unitsDeleteUnit) {
                const result = response.data.unitsDeleteUnit
                if (result.status === 'SUCCESS') {
                    deleteFromCache({id: unitId})
                    evictUnitsByLocation(client.cache)
                }
                const {status, errors} = result
                return {status, errors}
            }
            return {
                status: 'ERROR',
                errors: [{ message: 'Delete unit mutation returned no data.' }]
            }
        } catch (error) {
            return {
                status: 'ERROR',
                errors: [{ message: extractApolloErrorMessage(error, 'Failed to delete unit.') }]
            }
        }
    }

    return {
        getCached,

        createUnit,
        createUnitLoading,
        createUnitError,

        updateUnit,
        updateUnitLoading,
        updateUnitError,

        deleteUnit,
        deleteUnitLoading,
        deleteUnitError
    }

}
