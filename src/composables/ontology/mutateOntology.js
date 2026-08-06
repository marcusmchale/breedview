import { ref } from "vue";
import { useMutation } from '@vue/apollo-composable'

import COMMIT_VERSION from '../../graphql/ontology/commitVersion.graphql'
const commitVersionMutation = useMutation(COMMIT_VERSION)

import DEPRECATE_ENTRIES from '../../graphql/ontology/deprecateEntries.graphql'
import CANCEL_DEPRECATE_ENTRIES from '../../graphql/ontology/cancelDeprecateEntries.graphql'
import ENTRY_FRAGMENT from '../../graphql/ontology/entryFragment.graphql'

import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";
import { useOntologyRelationshipsQuery } from "@/composables/ontology/ontologyRelationshipsQuery";

import { useOntologyCreateMutations } from './createOntologyEntries'
import { useOntologyCreatorHandlers } from "./createOntologyEntries";
import { useOntologyUpdateMutations } from "@/composables/ontology/updateOntologyEntries";
import { useOntologyUpdateHandlers } from "@/composables/ontology/updateOntologyEntries";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";


export function useMutateOntology( { versionId, view } ) {

    const { updateCache, insertOntologyRelationships } = useCacheUpdates({
        typename: 'OntologyEntryUnion',
        fragment: ENTRY_FRAGMENT,
        ontologyVersionId: versionId,
        ontologyView: view
    })

    const createMutations = useOntologyCreateMutations()
    const updateMutations = useOntologyUpdateMutations()
    const creatorHandlers = useOntologyCreatorHandlers()
    const updateHandlers = useOntologyUpdateHandlers()


    const toRefetchEntryIds = ref(null)
    const { refetch: refetchEntries } = useOntologyEntriesQuery(
        { entryIds: toRefetchEntryIds, labels:null, view: view }
    )

    const toRefetchRelationshipsEntryIds = ref(null)
    const { refetch: refetchRelationships, relationships, onRelationshipsResult } = useOntologyRelationshipsQuery(
        { entryIds:toRefetchRelationshipsEntryIds, view: view }
    )

    // whenever we get a new relationships result we need to:
    // insert any new relationships into the ontology relationships array (if versionId and view match)
    // and refetch nodes at either end of the retrieved relationships
    onRelationshipsResult(async () => {
        console.log('Relationships retrieved', relationships.value)
        insertOntologyRelationships(relationships.value)
        const idsSet = new Set(toRefetchRelationshipsEntryIds.value);

        for (const { sourceId, targetId } of relationships.value) {
          idsSet.add(sourceId);
          idsSet.add(targetId);
        }
        toRefetchEntryIds.value = [...idsSet]
        await refetchEntries()
    })

    const refetchConnected = async (entryId) => {
        toRefetchRelationshipsEntryIds.value=[entryId]
        await refetchRelationships()

    }

    const {
        mutate: deprecateMutation,
        loading: deprecateLoading,
        error: deprecateError
    } = useMutation(DEPRECATE_ENTRIES)

    const deprecateEntries = async (entryIds) => {
        const response = await deprecateMutation({
            entryIds: entryIds
        })
        if (response?.data?.ontologyDeprecateEntries) {
            const result = response.data.ontologyDeprecateEntries
            if (result.status === 'SUCCESS') {
                entryIds.forEach((id) => {
                    updateCache({
                        id: id, versionId: versionId, view: view,
                        phase: "DEPRECATED"
                    })
                })
            }
            const { status, errors } = result
            return { status, errors }
        }
    }


    const {
        mutate: cancelDeprecateMutation,
        loading: cancelDeprecateLoading,
        error: cancelDeprecateError
    } = useMutation(CANCEL_DEPRECATE_ENTRIES)

    const cancelDeprecateEntries = async (entryIds) => {
        const response = await cancelDeprecateMutation({
            entryIds: entryIds
        })
        if (response?.data?.ontologyCancelDeprecateEntries) {
            const result = response.data.ontologyCancelDeprecateEntries
            if (result.status === 'SUCCESS') {
                console.log('refetch entries and relationships after cancel deprecation', entryIds)
                toRefetchEntryIds.value = entryIds.value
                await refetchEntries()
                toRefetchRelationshipsEntryIds.value = entryIds
                console.log('refetch relationships after cancel deprecation', toRefetchRelationshipsEntryIds.value)
                await refetchRelationships()

            }
            const { status, errors } = result
            return { status, errors }
        }
    }

    return {
        createMutations, creatorHandlers,
        updateMutations, updateHandlers,
        deprecateEntries, deprecateLoading, deprecateError,
        cancelDeprecateEntries, cancelDeprecateLoading, cancelDeprecateError,
        commitVersionMutation,
        refetchConnected
    }

}