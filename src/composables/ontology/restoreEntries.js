import { useApolloClient, useMutation } from '@vue/apollo-composable'

import { definitionIds } from '@/composables/ontology/ontologyLifecycles'

import ONTOLOGY_CURRENT_VERSION from '@/graphql/ontology/currentVersion.graphql'
import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'
import RESTORE_ENTRIES from '@/graphql/ontology/restoreEntries.graphql'

// Restoring removed ontology entries (ontologyRestoreEntries): each comes back as a draft, keeping its id, which the
// next commit activates. An entry can't come back without the entries it is defined by, so those removed too are
// restored with it: read as cited (the referential view), a removed entry is as it stood when it was removed, with the
// phase each entry has now.
export function useRestoreEntries() {
  const { resolveClient } = useApolloClient()

  // The entry, when removed, and the removed entries it is defined by, and those they are, in turn
  const entriesToRestore = async (entryId) => {
    const client = resolveClient()
    // entries are cached by version and view, so the query names the current version
    const { data: current } = await client.query({ query: ONTOLOGY_CURRENT_VERSION, fetchPolicy: 'network-only' })
    const versionId = current?.ontologyVersion?.result?.id
    const found = []
    const seen = new Set([String(entryId)])
    let ids = [String(entryId)]
    while (ids.length) {
      const { data } = await client.query({
        query: ONTOLOGY_ENTRIES_QUERY,
        variables: { entryIds: ids, versionId, view: 'REFERENTIAL' },
        fetchPolicy: 'network-only'
      })
      const payload = data?.ontologyEntries
      if (payload?.status !== 'SUCCESS') {
        throw new Error(payload?.errors?.[0]?.message || 'The entries could not be read')
      }
      ids = []
      for (const entry of payload.result) {
        // a current entry stays as it is; one deprecated but not yet removed the API refuses, and says so
        if (entry.phase !== 'REMOVED') continue
        found.push(entry)
        for (const id of definitionIds(entry)) {
          if (!seen.has(id)) {
            seen.add(id)
            ids.push(id)
          }
        }
      }
    }
    return found
  }

  const { mutate, loading: restoreLoading } = useMutation(RESTORE_ENTRIES)

  const restoreEntries = async (entries) => {
    const response = await mutate({ entryIds: entries.map((entry) => entry.id) })
    const payload = response?.data?.ontologyRestoreEntries
    if (!payload) return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
    if (payload.status === 'SUCCESS') {
      const cache = resolveClient().cache
      // the entries as cited now read as drafts, and the ontology is read again where it lists them
      for (const entry of entries) {
        const id = cache.identify(entry)
        if (id) cache.modify({ id, fields: { phase: () => 'DRAFT' } })
      }
      cache.evict({ id: 'ROOT_QUERY', fieldName: 'ontology' })
      cache.gc()
    }
    return { status: payload.status, errors: payload.errors }
  }

  return { entriesToRestore, restoreEntries, restoreLoading }
}
