import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'

import { useCacheUpdates } from '@/apolloConfig/cacheUpdates'
import { useOntologyEntriesQuery } from '@/composables/ontology/ontologyEntriesQuery'
import { useOntologyRelationshipsQuery } from '@/composables/ontology/ontologyRelationshipsQuery'

import ENTRY_FRAGMENT from '@/graphql/ontology/entryFragment.graphql'
import COMMIT_VERSION from '@/graphql/ontology/commitVersion.graphql'
import DEPRECATE_ENTRIES from '@/graphql/ontology/deprecateEntries.graphql'
import CANCEL_DEPRECATE_ENTRIES from '@/graphql/ontology/cancelDeprecateEntries.graphql'

import CREATE_TERM from '@/graphql/ontology/createTerm.graphql'
import UPDATE_TERM from '@/graphql/ontology/updateTerm.graphql'
import CREATE_SUBJECT from '@/graphql/ontology/createSubject.graphql'
import UPDATE_SUBJECT from '@/graphql/ontology/updateSubject.graphql'
import CREATE_TRAIT from '@/graphql/ontology/createTrait.graphql'
import UPDATE_TRAIT from '@/graphql/ontology/updateTrait.graphql'
import CREATE_CONDITION from '@/graphql/ontology/createCondition.graphql'
import UPDATE_CONDITION from '@/graphql/ontology/updateCondition.graphql'
import CREATE_SCALE from '@/graphql/ontology/createScale.graphql'
import UPDATE_SCALE from '@/graphql/ontology/updateScale.graphql'
import CREATE_CATEGORY from '@/graphql/ontology/createCategory.graphql'
import UPDATE_CATEGORY from '@/graphql/ontology/updateCategory.graphql'
import CREATE_OBSERVATION_METHOD from '@/graphql/ontology/createObservationMethod.graphql'
import UPDATE_OBSERVATION_METHOD from '@/graphql/ontology/updateObservationMethod.graphql'
import CREATE_VARIABLE from '@/graphql/ontology/createVariable.graphql'
import UPDATE_VARIABLE from '@/graphql/ontology/updateVariable.graphql'
import CREATE_CONTROL_METHOD from '@/graphql/ontology/createControlMethod.graphql'
import UPDATE_CONTROL_METHOD from '@/graphql/ontology/updateControlMethod.graphql'
import CREATE_FACTOR from '@/graphql/ontology/createFactor.graphql'
import UPDATE_FACTOR from '@/graphql/ontology/updateFactor.graphql'
import CREATE_EVENT from '@/graphql/ontology/createEvent.graphql'
import UPDATE_EVENT from '@/graphql/ontology/updateEvent.graphql'
import CREATE_LOCATION_TYPE from '@/graphql/ontology/createLocationType.graphql'
import UPDATE_LOCATION_TYPE from '@/graphql/ontology/updateLocationType.graphql'
import CREATE_DESIGN from '@/graphql/ontology/createDesign.graphql'
import UPDATE_DESIGN from '@/graphql/ontology/updateDesign.graphql'
import CREATE_LAYOUT_TYPE from '@/graphql/ontology/createLayoutType.graphql'
import UPDATE_LAYOUT_TYPE from '@/graphql/ontology/updateLayoutType.graphql'

// Helper: wrap a raw mutation response into { status, errors }
function extractResult(response, key) {
  if (response?.data?.[key]) {
    const { status, errors } = response.data[key]
    return { status, errors }
  }
  return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
}

export function useMutateOntology({ versionId, view }) {

  const { updateCache, insertOntologyRelationships } = useCacheUpdates({
    typename: 'OntologyEntryUnion',
    fragment: ENTRY_FRAGMENT,
    ontologyVersionId: versionId,
    ontologyView: view
  })

  // ── Commit version ──────────────────────────────────────────────────────────
  const {
    mutate: commitVersionMutation,
    loading: commitVersionLoading,
    error: commitVersionError
  } = useMutation(COMMIT_VERSION)

  // ── Refetch infrastructure ──────────────────────────────────────────────────
  const toRefetchEntryIds = ref(null)
  const { refetch: refetchEntries } = useOntologyEntriesQuery({
    entryIds: toRefetchEntryIds,
    labels: null,
    view: view
  })

  const toRefetchRelationshipsEntryIds = ref(null)
  const { refetch: refetchRelationships, relationships, onRelationshipsResult } = useOntologyRelationshipsQuery({
    entryIds: toRefetchRelationshipsEntryIds,
    view: view
  })

  onRelationshipsResult(async () => {
    insertOntologyRelationships(relationships.value)
    const idsSet = new Set(toRefetchRelationshipsEntryIds.value)
    for (const { sourceId, targetId } of relationships.value) {
      idsSet.add(sourceId)
      idsSet.add(targetId)
    }
    toRefetchEntryIds.value = [...idsSet]
    await refetchEntries()
  })

  const refetchConnected = async (entryId) => {
    toRefetchRelationshipsEntryIds.value = [entryId]
    await refetchRelationships()
  }

  // ── Deprecate / Cancel Deprecate ────────────────────────────────────────────
  const {
    mutate: deprecateMutation,
    loading: deprecateLoading,
    error: deprecateError
  } = useMutation(DEPRECATE_ENTRIES)

  const deprecateEntries = async (entryIds) => {
    const response = await deprecateMutation({ entryIds })
    if (response?.data?.ontologyDeprecateEntries) {
      const result = response.data.ontologyDeprecateEntries
      if (result.status === 'SUCCESS') {
        entryIds.forEach((id) => {
          updateCache({ id, versionId, view, phase: 'DEPRECATED' })
        })
      }
      const { status, errors } = result
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  const {
    mutate: cancelDeprecateMutation,
    loading: cancelDeprecateLoading,
    error: cancelDeprecateError
  } = useMutation(CANCEL_DEPRECATE_ENTRIES)

  const cancelDeprecateEntries = async (entryIds) => {
    const response = await cancelDeprecateMutation({ entryIds })
    if (response?.data?.ontologyCancelDeprecateEntries) {
      const result = response.data.ontologyCancelDeprecateEntries
      if (result.status === 'SUCCESS') {
        toRefetchEntryIds.value = entryIds
        await refetchEntries()
        toRefetchRelationshipsEntryIds.value = entryIds
        await refetchRelationships()
      }
      const { status, errors } = result
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // ── Per-type mutations ──────────────────────────────────────────────────────

  const { mutate: createTermMutation } = useMutation(CREATE_TERM)
  const { mutate: updateTermMutation } = useMutation(UPDATE_TERM)
  const createTerm = async (variables, controlTeamId) => {
    const response = await createTermMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateTerm')
  }
  const updateTerm = async (variables) => {
    const response = await updateTermMutation(variables)
    return extractResult(response, 'ontologyUpdateTerm')
  }

  const { mutate: createSubjectMutation } = useMutation(CREATE_SUBJECT)
  const { mutate: updateSubjectMutation } = useMutation(UPDATE_SUBJECT)
  const createSubject = async (variables, controlTeamId) => {
    const response = await createSubjectMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateSubject')
  }
  const updateSubject = async (variables) => {
    const response = await updateSubjectMutation(variables)
    return extractResult(response, 'ontologyUpdateSubject')
  }

  const { mutate: createTraitMutation } = useMutation(CREATE_TRAIT)
  const { mutate: updateTraitMutation } = useMutation(UPDATE_TRAIT)
  const createTrait = async (variables, controlTeamId) => {
    const response = await createTraitMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateTrait')
  }
  const updateTrait = async (variables) => {
    const response = await updateTraitMutation(variables)
    return extractResult(response, 'ontologyUpdateTrait')
  }

  const { mutate: createConditionMutation } = useMutation(CREATE_CONDITION)
  const { mutate: updateConditionMutation } = useMutation(UPDATE_CONDITION)
  const createCondition = async (variables, controlTeamId) => {
    const response = await createConditionMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateCondition')
  }
  const updateCondition = async (variables) => {
    const response = await updateConditionMutation(variables)
    return extractResult(response, 'ontologyUpdateCondition')
  }

  const { mutate: createScaleMutation } = useMutation(CREATE_SCALE)
  const { mutate: updateScaleMutation } = useMutation(UPDATE_SCALE)
  const createScale = async (variables, controlTeamId) => {
    const response = await createScaleMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateScale')
  }
  const updateScale = async (variables) => {
    const response = await updateScaleMutation(variables)
    return extractResult(response, 'ontologyUpdateScale')
  }

  const { mutate: createCategoryMutation } = useMutation(CREATE_CATEGORY)
  const { mutate: updateCategoryMutation } = useMutation(UPDATE_CATEGORY)
  const createCategory = async (variables, controlTeamId) => {
    const response = await createCategoryMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateCategory')
  }
  const updateCategory = async (variables) => {
    const response = await updateCategoryMutation(variables)
    return extractResult(response, 'ontologyUpdateCategory')
  }

  const { mutate: createObservationMethodMutation } = useMutation(CREATE_OBSERVATION_METHOD)
  const { mutate: updateObservationMethodMutation } = useMutation(UPDATE_OBSERVATION_METHOD)
  const createObservationMethod = async (variables, controlTeamId) => {
    const response = await createObservationMethodMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateObservationMethod')
  }
  const updateObservationMethod = async (variables) => {
    const response = await updateObservationMethodMutation(variables)
    return extractResult(response, 'ontologyUpdateObservationMethod')
  }

  const { mutate: createVariableMutation } = useMutation(CREATE_VARIABLE)
  const { mutate: updateVariableMutation } = useMutation(UPDATE_VARIABLE)
  const createVariable = async (variables, controlTeamId) => {
    const response = await createVariableMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateVariable')
  }
  const updateVariable = async (variables) => {
    const response = await updateVariableMutation(variables)
    return extractResult(response, 'ontologyUpdateVariable')
  }

  const { mutate: createControlMethodMutation } = useMutation(CREATE_CONTROL_METHOD)
  const { mutate: updateControlMethodMutation } = useMutation(UPDATE_CONTROL_METHOD)
  const createControlMethod = async (variables, controlTeamId) => {
    const response = await createControlMethodMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateControlMethod')
  }
  const updateControlMethod = async (variables) => {
    const response = await updateControlMethodMutation(variables)
    return extractResult(response, 'ontologyUpdateControlMethod')
  }

  const { mutate: createFactorMutation } = useMutation(CREATE_FACTOR)
  const { mutate: updateFactorMutation } = useMutation(UPDATE_FACTOR)
  const createFactor = async (variables, controlTeamId) => {
    const response = await createFactorMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateFactor')
  }
  const updateFactor = async (variables) => {
    const response = await updateFactorMutation(variables)
    return extractResult(response, 'ontologyUpdateFactor')
  }

  const { mutate: createEventMutation } = useMutation(CREATE_EVENT)
  const { mutate: updateEventMutation } = useMutation(UPDATE_EVENT)
  const createEvent = async (variables, controlTeamId) => {
    const response = await createEventMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateEvent')
  }
  const updateEvent = async (variables) => {
    const response = await updateEventMutation(variables)
    return extractResult(response, 'ontologyUpdateEvent')
  }

  const { mutate: createLocationTypeMutation } = useMutation(CREATE_LOCATION_TYPE)
  const { mutate: updateLocationTypeMutation } = useMutation(UPDATE_LOCATION_TYPE)
  const createLocationType = async (variables, controlTeamId) => {
    const response = await createLocationTypeMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateLocationType')
  }
  const updateLocationType = async (variables) => {
    const response = await updateLocationTypeMutation(variables)
    return extractResult(response, 'ontologyUpdateLocationType')
  }

  const { mutate: createDesignMutation } = useMutation(CREATE_DESIGN)
  const { mutate: updateDesignMutation } = useMutation(UPDATE_DESIGN)
  const createDesign = async (variables, controlTeamId) => {
    const response = await createDesignMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateDesign')
  }
  const updateDesign = async (variables) => {
    const response = await updateDesignMutation(variables)
    return extractResult(response, 'ontologyUpdateDesign')
  }

  const { mutate: createLayoutTypeMutation } = useMutation(CREATE_LAYOUT_TYPE)
  const { mutate: updateLayoutTypeMutation } = useMutation(UPDATE_LAYOUT_TYPE)
  const createLayoutType = async (variables, controlTeamId) => {
    const response = await createLayoutTypeMutation({ ...variables, controlTeamId })
    return extractResult(response, 'ontologyCreateLayoutType')
  }
  const updateLayoutType = async (variables) => {
    const response = await updateLayoutTypeMutation(variables)
    return extractResult(response, 'ontologyUpdateLayoutType')
  }

  return {
    createTerm, updateTerm,
    createSubject, updateSubject,
    createTrait, updateTrait,
    createCondition, updateCondition,
    createScale, updateScale,
    createCategory, updateCategory,
    createObservationMethod, updateObservationMethod,
    createVariable, updateVariable,
    createControlMethod, updateControlMethod,
    createFactor, updateFactor,
    createEvent, updateEvent,
    createLocationType, updateLocationType,
    createDesign, updateDesign,
    createLayoutType, updateLayoutType,
    deprecateEntries, deprecateLoading, deprecateError,
    cancelDeprecateEntries, cancelDeprecateLoading, cancelDeprecateError,
    commitVersionMutation, commitVersionLoading, commitVersionError,
    refetchConnected
  }
}