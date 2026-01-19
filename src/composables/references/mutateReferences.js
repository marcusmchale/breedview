
import { useMutation } from '@vue/apollo-composable'
import { useCacheUpdates } from "@/composables/system/cacheUpdates";

import CREATE_DATA_FILE_REFERENCE from "@/graphql/references/createDataFileReference.graphql";
import UPDATE_DATA_FILE_REFERENCE from "@/graphql/references/updateDataFileReference.graphql";
import CREATE_LEGAL_REFERENCE from "@/graphql/references/createLegalReference.graphql";
import UPDATE_LEGAL_REFERENCE from "@/graphql/references/updateLegalReference.graphql";
import CREATE_EXTERNAL_REFERENCE from "@/graphql/references/createExternalReference.graphql";
import UPDATE_EXTERNAL_REFERENCE from "@/graphql/references/updateExternalReference.graphql";
import CREATE_FILE_REFERENCE from "@/graphql/references/createFileReference.graphql";
import UPDATE_FILE_REFERENCE from "@/graphql/references/updateFileReference.graphql";
import DELETE_REFERENCES from "@/graphql/references/deleteReferences.graphql";
import REFERENCE_FRAGMENT from "@/graphql/references/referenceFragment.graphql";

export function useMutateReferences() {

    const { updateItem, deleteItem } = useCacheUpdates({
        typename: "Reference",
        fragment: REFERENCE_FRAGMENT
    })

    // Data File Reference mutations (existing)
    const {
        mutate: createDataFileReferenceMutation,
        loading: createDataFileReferenceLoading,
        error: createDataFileReferenceError
    } = useMutation(CREATE_DATA_FILE_REFERENCE);

    const createDataFileReference = async (reference) => {
      const response = await createDataFileReferenceMutation({ reference: reference });
      const { result, status, errors } = response?.data?.referencesCreateDataFile
      return { result, status, errors }
    }

    const {
        mutate: updateDataFileReferenceMutation,
        loading: updateDataFileReferenceLoading,
        error: updateDataFileReferenceError
    } = useMutation(UPDATE_DATA_FILE_REFERENCE);

    const updateDataFileReference = async (reference) => {
        const response = await updateDataFileReferenceMutation({ reference: reference });
        if (response?.data?.referencesUpdateDataFile) {
          const data = response.data.referencesUpdateDataFile
          if (data.status === "SUCCESS" ) {
            updateItem({
              updateData: reference,
              idField: 'referenceId'
            })
          }
          const { result, status, errors} = data
          return { result, status, errors }
        }
    }

    // Legal Reference mutations
    const {
        mutate: createLegalReferenceMutation,
        loading: createLegalReferenceLoading,
        error: createLegalReferenceError
    } = useMutation(CREATE_LEGAL_REFERENCE);

    const createLegalReference = async (reference) => {
        const response = await createLegalReferenceMutation({ reference });
        const { result, status, errors } = response?.data?.referencesCreateLegal || {}
        return { result, status, errors }
    }

    const {
        mutate: updateLegalReferenceMutation,
        loading: updateLegalReferenceLoading,
        error: updateLegalReferenceError
    } = useMutation(UPDATE_LEGAL_REFERENCE);

    const updateLegalReference = async (reference) => {
        const response = await updateLegalReferenceMutation({ reference });
        if (response?.data?.referencesUpdateLegal) {
            const data = response.data.referencesUpdateLegal
            if (data.status === "SUCCESS") {
                updateItem({
                    updateData: reference,
                    idField: 'referenceId'
                })
            }
            const { result, status, errors } = data
            return { result, status, errors }
        }
    }

    // External Reference mutations
    const {
        mutate: createExternalReferenceMutation,
        loading: createExternalReferenceLoading,
        error: createExternalReferenceError
    } = useMutation(CREATE_EXTERNAL_REFERENCE);

    const createExternalReference = async (reference) => {
        const response = await createExternalReferenceMutation({ reference });
        const { result, status, errors } = response?.data?.referencesCreateExternal || {}
        return { result, status, errors }
    }

    const {
        mutate: updateExternalReferenceMutation,
        loading: updateExternalReferenceLoading,
        error: updateExternalReferenceError
    } = useMutation(UPDATE_EXTERNAL_REFERENCE);

    const updateExternalReference = async (reference) => {
        const response = await updateExternalReferenceMutation({ reference });
        if (response?.data?.referencesUpdateExternal) {
            const data = response.data.referencesUpdateExternal
            if (data.status === "SUCCESS") {
                updateItem({
                    updateData: reference,
                    idField: 'referenceId'
                })
            }
            const { result, status, errors } = data
            return { result, status, errors }
        }
    }

    // File Reference mutations
    const {
        mutate: createFileReferenceMutation,
        loading: createFileReferenceLoading,
        error: createFileReferenceError
    } = useMutation(CREATE_FILE_REFERENCE);

    const createFileReference = async (reference) => {
        const response = await createFileReferenceMutation({ reference });
        const { result, status, errors } = response?.data?.referencesCreateFile || {}
        return { result, status, errors }
    }

    const {
        mutate: updateFileReferenceMutation,
        loading: updateFileReferenceLoading,
        error: updateFileReferenceError
    } = useMutation(UPDATE_FILE_REFERENCE);

    const updateFileReference = async (reference) => {
        const response = await updateFileReferenceMutation({ reference });
        if (response?.data?.referencesUpdateFile) {
            const data = response.data.referencesUpdateFile
            const { result, status, errors } = data
            return { result, status, errors }
        }
    }

    // Delete mutations
    const {
        mutate: deleteReferencesMutation,
        loading: deleteReferencesLoading,
        error: deleteReferencesError
    } = useMutation(DELETE_REFERENCES);

    const deleteReferences = async (referenceIds) => {
        const response = await deleteReferencesMutation({ referenceIds: referenceIds });

        if (response?.data?.referencesDelete) {
            const result = response.data.referencesDelete
            if (result.status === 'SUCCESS') {
                referenceIds.forEach((referenceId) => {
                  deleteItem({itemId: referenceId})
                })
            }
            const { status, errors } = result
            return { status, errors }
        }
    };

    return {
      // Data File
      createDataFileReference,
      createDataFileReferenceLoading,
      createDataFileReferenceError,
      updateDataFileReference,
      updateDataFileReferenceLoading,
      updateDataFileReferenceError,

      // Legal
      createLegalReference,
      createLegalReferenceLoading,
      createLegalReferenceError,
      updateLegalReference,
      updateLegalReferenceLoading,
      updateLegalReferenceError,

      // External
      createExternalReference,
      createExternalReferenceLoading,
      createExternalReferenceError,
      updateExternalReference,
      updateExternalReferenceLoading,
      updateExternalReferenceError,

      // File
      createFileReference,
      createFileReferenceLoading,
      createFileReferenceError,
      updateFileReference,
      updateFileReferenceLoading,
      updateFileReferenceError,

      // Delete
      deleteReferences,
      deleteReferencesLoading,
      deleteReferencesError
    };
}