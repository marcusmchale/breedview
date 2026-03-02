import { useMutation } from '@vue/apollo-composable'

import COMMIT_VERSION from '../../graphql/ontology/commitVersion.graphql'
import DEPRECATE_ENTRIES from '../../graphql/ontology/deprecateEntries.graphql'
import ENTRY_FRAGMENT from '../../graphql/ontology/entryFragment.graphql'

import { useOntologyCreateMutations } from './createOntologyEntries'
import { useOntologyCreatorHandlers } from "./createOntologyEntries";
import { useOntologyUpdateMutations } from "@/composables/ontology/updateOntologyEntries";
import { useOntologyUpdateHandlers } from "@/composables/ontology/updateOntologyEntries";
import { useCacheUpdates } from "@/composables/system/cacheUpdates";


export function useMutateOntology( { versionId } ) {

    const { updateOntologyEntryLifecycle } = useCacheUpdates({typename: 'OntologyEntryInterface', fragment:ENTRY_FRAGMENT})

    const createMutations = useOntologyCreateMutations()
    const updateMutations = useOntologyUpdateMutations()
    const creatorHandlers = useOntologyCreatorHandlers()
    const updateHandlers = useOntologyUpdateHandlers()

    const {
        mutate: deprecateMutation,
        loading: deprecateLoading,
        error: deprecateError
    } = useMutation(DEPRECATE_ENTRIES)

    const deprecateEntries = async (entryIds) => {
        console.log('deprecating:', entryIds)
        const response = await deprecateMutation({
            entryIds: entryIds
        })
        console.log('response:', response)
        if (response?.data?.ontologyDeprecateEntries) {
            const result = response.data.ontologyDeprecateEntries
            if (result.status === 'SUCCESS') {
                entryIds.forEach((id) => {
                    updateOntologyEntryLifecycle(
                        id,
                        versionId,
                        'DEPRECATED'
                    )
                })
            }
            const { status, errors } = result
            return { status, errors }
        }
    }
    const commitVersionMutation = useMutation(COMMIT_VERSION)


    return {
        createMutations, creatorHandlers,
        updateMutations, updateHandlers,
        deprecateEntries, deprecateLoading, deprecateError,
        commitVersionMutation
    }

}