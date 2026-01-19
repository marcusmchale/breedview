import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import PROGRAM_QUERY from '@/graphql/programs/program.graphql'

export function useProgramQuery(programId) {

  const queryEnabled = computed(() => {
    return toValue(programId) !== null && toValue(programId) !== undefined
  })

  const {
    result: programResult,
    loading: programLoading,
    error: programError,
    refetch: refetchProgram
  } = useQuery(
    PROGRAM_QUERY,
    () => ({ programId: toValue(programId) }),
    { enabled: queryEnabled }
  )

  const program = computed(() => {
    return programResult.value?.programsProgram?.result
  })

  const queryErrors = computed(() => {
    return programResult.value?.programsProgram?.errors || []
  })

  return {
    program,
    programLoading,
    programError,
    queryErrors,
    refetchProgram
  }
}