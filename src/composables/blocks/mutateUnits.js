import { ref } from 'vue'
import { useLazyQuery, useMutation } from '@vue/apollo-composable'
import { useCacheUpdates } from "@/composables/system/cacheUpdates";

import UNITS_QUERY from '@/graphql/blocks/units.graphql'
import UNIT_FRAGMENT from '@/graphql/blocks/unitFragment.graphql'
import CREATE_UNIT_MUTATION from '@/graphql/blocks/createUnit.graphql'
import UPDATE_UNIT_MUTATION from '@/graphql/blocks/updateUnit.graphql'
import DELETE_UNIT_MUTATION from '@/graphql/blocks/deleteUnit.graphql'


export function useMutateUnits() {

    const { getCached, updateItem, deleteItem } = useCacheUpdates({
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

    const createUnit = async (unitData, position) => {
        const response = await createUnitMutation({unit: unitData, position: position})

        if (response?.data?.blocksCreateUnit) {
            const result = response.data.blocksCreateUnit
            if (result.status === 'SUCCESS') {
                reloadUnits([unitData.parentId])
            }
            const { status, errors } = result
            return { status, errors }
        }
    }

    // Update a unit
    const {
        mutate: updateUnitMutation,
        loading: updateUnitLoading,
        error: updateUnitError
    } = useMutation(UPDATE_UNIT_MUTATION)


    const updateUnit = async (unitData) => {
        const response = await updateUnitMutation({unit: unitData})
        if (response?.data?.blocksUpdateUnit) {
            const result = response.data.blocksUpdateUnit
            if (result.status === 'SUCCESS') {
                updateItem({
                    updateData: unitData,
                    idField: 'unitId'
                })
            }
            const { status, errors} = result
            return { status, errors }
        }
    }

    // Delete a unit
    const {
        mutate: deleteUnitMutation,
        loading: deleteUnitLoading,
        error: deleteUnitError
    } = useMutation(DELETE_UNIT_MUTATION)

    const deleteUnit = async (unitId) => {
        const response = await deleteUnitMutation({
            unitId: unitId
        })
        if (response?.data?.blocksDeleteUnit) {
            const result = response.data.blocksDeleteUnit
            if (result.status === 'SUCCESS') {
                deleteItem({itemId: unitId})
            }
            const {status, errors} = result
            return {status, errors}
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
