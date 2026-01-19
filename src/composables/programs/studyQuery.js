import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import STUDY_QUERY from '@/graphql/programs/study.graphql'

export function useStudyQuery(studyId) {

    const queryEnabled = computed(() => {
        return toValue(studyId) !== null && toValue(studyId) !== undefined
    })

    const {
        result: studyResult,
        loading: studyLoading,
        error: studyError,
        refetch: refetchStudy
    } = useQuery(
        STUDY_QUERY,
        () => ({ studyId: toValue(studyId) }),
        { enabled: queryEnabled }
    )

    const study = computed(() => {
        return studyResult.value?.programsStudy?.result || null
    })

    const queryErrors = computed(() => {
        return studyResult.value?.programsStudy?.errors || []
    })

    return {
        study,
        studyLoading,
        studyError,
        queryErrors,
        refetchStudy
    }
}