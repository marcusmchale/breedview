import { ref, computed, toValue } from 'vue'
import { useProgramsQuery } from './programsQuery'
import { useTrialQuery } from './trialQuery'

export function useProgramTreeQueries() {
  // Root programs query
  const {
    programs,
    programsLoading,
    programsError,
    refetchPrograms
  } = useProgramsQuery()

  // Current expanded program/trial for loading children
  const expandedProgramId = ref(null)
  const expandedTrialId = ref(null)

  // Trial query - loads studies for the expanded trial
  const {
    trial: expandedTrial,
    trialLoading: trialChildrenLoading,
    trialError: trialChildrenError
  } = useTrialQuery(expandedTrialId)

  // Get trials for an expanded program (from the programs query result)
  const getTrialsForProgram = (programId) => {
    const program = programs.value.find(p => p.id === programId)
    return program?.trials || []
  }

  // Get studies for an expanded trial
  const getStudiesForTrial = (trialId) => {
    if (toValue(expandedTrialId) === trialId && expandedTrial.value) {
      return expandedTrial.value.studies || []
    }
    return []
  }

  // Load children for a node
  const loadChildren = (nodeId, node) => {
    const typeName = node?.__typename
    if (typeName === 'Program') {
      expandedProgramId.value = nodeId
      // Trials are already in the programs query, no separate load needed
    } else if (typeName === 'Trial') {
      expandedTrialId.value = nodeId
    }
  }

  const childrenLoading = computed(() => {
    return programsLoading.value || trialChildrenLoading.value
  })

  return {
    // Root programs
    programs,
    programsLoading,
    programsError,
    refetchPrograms,

    // Children loading
    loadChildren,
    childrenLoading,
    getTrialsForProgram,
    getStudiesForTrial,
    expandedProgramId,
    expandedTrialId,
    trialChildrenLoading,
    trialChildrenError
  }
}