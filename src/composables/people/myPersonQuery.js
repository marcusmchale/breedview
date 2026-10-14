import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import MY_PERSON_QUERY from '@/graphql/people/myPerson.graphql'

// The Person linked to the current user's account, in full, or null when none is linked
export function useMyPersonQuery() {
  const {
    result,
    loading: myPersonLoading,
    error: myPersonError,
    refetch: refetchMyPerson
  } = useQuery(MY_PERSON_QUERY, {}, { fetchPolicy: 'cache-and-network' })

  const myPerson = computed(() => {
    const payload = result.value?.peopleMyPerson
    return payload?.status === 'SUCCESS' ? payload.result : null
  })

  return {
    myPerson,
    myPersonLoading,
    myPersonError,
    refetchMyPerson
  }
}
