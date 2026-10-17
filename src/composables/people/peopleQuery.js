import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import PEOPLE_QUERY from '@/graphql/people/people.graphql'

// Persons the user sees in full or by attribution, optionally by exact name (case insensitive on the API).
// Needs an account: pass enabled where signed-out visitors may be
export function usePeopleQuery(name = null, { enabled = true } = {}) {
  const {
    result,
    loading: peopleLoading,
    error: peopleError,
    refetch: refetchPeople
  } = useQuery(
    PEOPLE_QUERY,
    () => ({ name: toValue(name) || null }),
    () => ({ enabled: toValue(enabled) })
  )

  const people = computed(() => {
    const items = [...(result.value?.people?.result ?? [])]
    items.sort((a, b) => (a?.name || '').localeCompare(b?.name || '') || (a?.id - b?.id))
    return items
  })

  const queryErrors = computed(() => result.value?.people?.errors ?? [])

  return {
    people,
    peopleLoading,
    peopleError,
    queryErrors,
    refetchPeople
  }
}
