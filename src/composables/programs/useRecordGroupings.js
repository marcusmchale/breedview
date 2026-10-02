import { computed } from 'vue'

import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";
import { useStudyQuery } from "@/composables/programs/studyQuery";

import { useMutateGroupings } from "@/composables/programs/mutateGroupings";


export function useRecordGroupings(studyId) {

  const {
    study, studyLoading, studyError, refetchStudy
  } = useStudyQuery(studyId)

  const {
    entries: recordGroupTypes,
    entriesLoading: recordGroupTypesLoading,
    entriesError: recordGroupTypesError
  } = useOntologyEntriesQuery({labels: ['RECORD_GROUP_TYPE'], view: "PUBLISHED"})

  const {
    createGrouping, createGroupingLoading, createGroupingError,
    updateGrouping, updateGroupingLoading, updateGroupingError,
    deleteGrouping, deleteGroupingLoading, deleteGroupingError
  } = useMutateGroupings( { studyId })

  // Computed properties
  const groupings = computed(() => study.value?.groupings || [])
  const isLoading = computed(() => studyLoading.value || recordGroupTypesLoading.value)

  return {
    refetchStudy,
    recordGroupTypes, recordGroupTypesLoading, recordGroupTypesError,

    groupings, groupingsLoading: studyLoading, groupingsError: studyError,
    isLoading,

    createGroupingLoading,
    updateGroupingLoading,
    deleteGroupingLoading,
    createGrouping,
    updateGrouping,
    deleteGrouping,
    createGroupingError,
    updateGroupingError,
    deleteGroupingError
  }
}