import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import MY_CLAIMS_QUERY from '@/graphql/people/myClaims.graphql'
import CLAIM_REQUESTS_QUERY from '@/graphql/people/claimRequests.graphql'

// The current user's pending requests to be linked to a Person
export function useMyClaimsQuery() {
  const {
    result,
    loading: myClaimsLoading,
    error: myClaimsError,
    refetch: refetchMyClaims
  } = useQuery(MY_CLAIMS_QUERY, {}, { fetchPolicy: 'cache-and-network' })

  const myClaims = computed(() => result.value?.peopleMyClaims?.result ?? [])

  return {
    myClaims,
    myClaimsLoading,
    myClaimsError,
    refetchMyClaims
  }
}

// Pending requests to link to Persons controlled by teams the user administers
export function useClaimRequestsQuery() {
  const {
    result,
    loading: claimRequestsLoading,
    error: claimRequestsError,
    refetch: refetchClaimRequests
  } = useQuery(CLAIM_REQUESTS_QUERY, {}, { fetchPolicy: 'cache-and-network' })

  const claimRequests = computed(() => result.value?.peopleClaimRequests?.result ?? [])

  return {
    claimRequests,
    claimRequestsLoading,
    claimRequestsError,
    refetchClaimRequests
  }
}
