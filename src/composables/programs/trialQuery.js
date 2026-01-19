import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import TRIAL_QUERY from '@/graphql/programs/trial.graphql'

export function useTrialQuery(trialId) {

    const queryEnabled = computed(() => {
        return toValue(trialId) !== null && toValue(trialId) !== undefined
    })

    const {
        result: trialResult,
        loading: trialLoading,
        error: trialError,
        refetch: refetchTrial
    } = useQuery(
        TRIAL_QUERY,
        () => ({ trialId: toValue(trialId) }),
        { enabled: queryEnabled }
    )

    const trial = computed(() => {
        return trialResult.value?.programsTrial?.result || null
    })

    const queryErrors = computed(() => {
        return trialResult.value?.programsTrial?.errors || []
    })

    return {
        trial,
        trialLoading,
        trialError,
        queryErrors,
        refetchTrial
    }
}