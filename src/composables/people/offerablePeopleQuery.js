import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import CONTROLLER_ACCESS_QUERY from '@/graphql/controls/controllerAccess.graphql'
import { usePeopleQuery } from '@/composables/people/peopleQuery'

// Persons the user can offer with an invitation, for the invited user to link to their account: those not linked or
// erased that a team the user administers controls, as the API requires (accountsInvite personId). The people the user
// sees in full are read first, then the access to them in one request; controllers come back in the order asked.
export function useOfferablePeople({ enabled = true } = {}) {
  const { people, peopleLoading } = usePeopleQuery(null, { enabled })

  const candidates = computed(() =>
    people.value.filter((person) => person.view === 'FULL' && !person.linked && !person.erased)
  )
  const candidateIds = computed(() => candidates.value.map((person) => person.id))

  const { result, loading: accessLoading } = useQuery(
    CONTROLLER_ACCESS_QUERY,
    () => ({ entityLabel: 'PERSON', entityIds: candidateIds.value }),
    () => ({ enabled: toValue(enabled) && candidateIds.value.length > 0 })
  )

  const offerablePeople = computed(() => {
    const controllers = result.value?.controlsControllers?.result ?? []
    if (controllers.length !== candidates.value.length) return []
    return candidates.value.filter((_, index) => controllers[index]?.access?.includes('ADMIN'))
  })

  return {
    offerablePeople,
    offerablePeopleLoading: computed(() => peopleLoading.value || accessLoading.value)
  }
}
