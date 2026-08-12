import { toValue } from "vue"
import { useMutation } from '@vue/apollo-composable'
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";

import CREATE_DATA_FILE_REFERENCE from "@/graphql/references/createDataFileReference.graphql";
import UPDATE_DATA_FILE_REFERENCE from "@/graphql/references/updateDataFileReference.graphql";
import CREATE_EXTERNAL_DATA_REFERENCE from "@/graphql/references/createExternalDataReference.graphql";
import UPDATE_EXTERNAL_DATA_REFERENCE from "@/graphql/references/updateExternalDataReference.graphql";
import CREATE_LEGAL_REFERENCE from "@/graphql/references/createLegalReference.graphql";
import UPDATE_LEGAL_REFERENCE from "@/graphql/references/updateLegalReference.graphql";
import CREATE_EXTERNAL_REFERENCE from "@/graphql/references/createExternalReference.graphql";
import UPDATE_EXTERNAL_REFERENCE from "@/graphql/references/updateExternalReference.graphql";
import CREATE_FILE_REFERENCE from "@/graphql/references/createFileReference.graphql";
import UPDATE_FILE_REFERENCE from "@/graphql/references/updateFileReference.graphql";
import DELETE_REFERENCES from "@/graphql/references/deleteReferences.graphql";
import REFERENCE_FRAGMENT from "@/graphql/references/referenceFragment.graphql";



export function useMutateReferences() {
    // Data File Reference mutations
    const { updateCache, deleteFromCache } = useCacheUpdates({
        typename: "Reference",
        fragment: REFERENCE_FRAGMENT
    })

    const {
        mutate: createDataFileReferenceMutation,
        loading: createDataFileReferenceLoading,
        error: createDataFileReferenceError
    } = useMutation(CREATE_DATA_FILE_REFERENCE);

    const createDataFileReference = async ({ reference, controlTeamId, release }) => {
      const response = await createDataFileReferenceMutation({
          reference: reference,
          controlTeamId: toValue(controlTeamId),
          release: toValue(release)
      });
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
            updateCache({
              updateData: reference,
              idField: 'referenceId'
            })
          }
          const { result, status, errors} = data
          return { result, status, errors }
        }
    }

    // External Data Reference mutations
    const {
        mutate: createExternalDataReferenceMutation,
        loading: createExternalDataReferenceLoading,
        error: createExternalDataReferenceError
    } = useMutation(CREATE_EXTERNAL_DATA_REFERENCE);

    const createExternalDataReference = async ({ reference, controlTeamId, release }) => {
        const response = await createExternalDataReferenceMutation({
            reference: reference,
            controlTeamId: toValue(controlTeamId),
            release: toValue(release)
        });
        const { result, status, errors } = response?.data?.referencesCreateExternalData || {}
        return { result, status, errors }
    }

    const {
        mutate: updateExternalDataReferenceMutation,
        loading: updateExternalDataReferenceLoading,
        error: updateExternalDataReferenceError
    } = useMutation(UPDATE_EXTERNAL_DATA_REFERENCE);

    const updateExternalDataReference = async (reference) => {
        const response = await updateExternalDataReferenceMutation({ reference });
        if (response?.data?.referencesUpdateExternalData) {
            const data = response.data.referencesUpdateExternalData
            if (data.status === "SUCCESS") {
                updateCache({
                    updateData: reference,
                    idField: 'referenceId'
                })
            }
            const { result, status, errors } = data
            return { result, status, errors }
        }
    }

    // Legal Reference mutations
    const {
        mutate: createLegalReferenceMutation,
        loading: createLegalReferenceLoading,
        error: createLegalReferenceError
    } = useMutation(CREATE_LEGAL_REFERENCE);

    const createLegalReference = async ({ reference, controlTeamId, release }) => {
        const response = await createLegalReferenceMutation(
            {
                reference: reference,
                controlTeamId: toValue(controlTeamId),
                release: toValue(release)
            });
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
                updateCache({
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

    const createExternalReference = async ({ reference, controlTeamId, release}) => {
        const response = await createExternalReferenceMutation({
            reference: reference,
            controlTeamId: toValue(controlTeamId),
            release: toValue(release)
        });
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
                updateCache({
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

    const createFileReference = async ({ reference, controlTeamId, release }) => {
        const response = await createFileReferenceMutation({
            reference: reference,
            controlTeamId: toValue(controlTeamId),
            release: toValue(release)
        });
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
        console.log('update response', response)
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
                  deleteFromCache({id: referenceId})
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

      // Externa Data
      createExternalDataReference,
      createExternalDataReferenceLoading,
      createExternalDataReferenceError,
      updateExternalDataReference,
      updateExternalDataReferenceLoading,
      updateExternalDataReferenceError,

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