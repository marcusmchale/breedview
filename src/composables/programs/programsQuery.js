import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import PROGRAMS_QUERY from '@/graphql/programs/programs.graphql'

export function useProgramsQuery() {

    const {
        result: programsResult,
        loading: programsLoading,
        error: programsError,
        refetch: refetchPrograms
    } = useQuery(PROGRAMS_QUERY)

    const programs = computed(() => {
        if (!programsResult.value?.programs?.result) {
            return []
        }
        const programs = [...programsResult.value?.programs?.result]
        programs.sort((a, b) => a.name.localeCompare(b.name))
        return programs
    })

    const queryErrors = computed(() => {
        return programsResult.value?.programs?.errors || []
    })

    return {
        programs,
        programsLoading,
        programsError,
        queryErrors,
        refetchPrograms
    }
}