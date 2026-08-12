import { toValue } from 'vue'
import { useMutation } from '@vue/apollo-composable'

import GERMPLASM_CREATE_ENTRY from '@/graphql/germplasm/createEntry.graphql'
import GERMPLASM_UPDATE_ENTRY from '@/graphql/germplasm/updateEntry.graphql'
import DELETE_ENTRY from '@/graphql/germplasm/deleteEntry.graphql'

export function useMutateEntries() {
  // Create entry
  const {
    mutate: createEntryMutation,
    loading: createEntryLoading,
    error: createEntryError
  } = useMutation(GERMPLASM_CREATE_ENTRY)

  const createEntry = async ({ entryData, controlTeamId, release }) => {
    console.debug('Creating entry with controlTeamId:', toValue(controlTeamId), 'and release:', toValue(release))
    const response = await createEntryMutation({
      entry: entryData,
      controlTeamId: toValue(controlTeamId),
      release: toValue(release)
    })
    if (response?.data?.germplasmCreateEntry) {
      const { status, errors } = response.data.germplasmCreateEntry
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Update entry
  const {
    mutate: updateEntryMutation,
    loading: updateEntryLoading,
    error: updateEntryError
  } = useMutation(GERMPLASM_UPDATE_ENTRY)

  const updateEntry = async (entryData) => {
    const response = await updateEntryMutation({ entry: entryData })
    if (response?.data?.germplasmUpdateEntry) {
      const { status, errors } = response.data.germplasmUpdateEntry
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Delete entry
  const {
    mutate: deleteEntryMutation,
    loading: deleteEntryLoading,
    error: deleteEntryError
  } = useMutation(DELETE_ENTRY)

  const deleteEntry = async (entryId) => {
    const response = await deleteEntryMutation({ entryId })
    if (response?.data?.germplasmDeleteEntry) {
      const { status, errors } = response.data.germplasmDeleteEntry
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return {
    createEntry,
    createEntryLoading,
    createEntryError,

    updateEntry,
    updateEntryLoading,
    updateEntryError,

    deleteEntry,
    deleteEntryLoading,
    deleteEntryError
  }
}