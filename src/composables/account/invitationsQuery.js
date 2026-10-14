import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import INVITATIONS_QUERY from '@/graphql/account/invitations.graphql'

// Pending invitations sent by the current user
export function useInvitationsQuery({ enabled = true } = {}) {
  const {
    result,
    loading: invitationsLoading,
    error: invitationsError,
    refetch: refetchInvitations
  } = useQuery(
    INVITATIONS_QUERY,
    {},
    () => ({ enabled: toValue(enabled), fetchPolicy: 'cache-and-network' })
  )

  const invitations = computed(() => result.value?.accountsAccount?.result?.invitations ?? [])
  const queryErrors = computed(() => result.value?.accountsAccount?.errors ?? [])

  return {
    invitations,
    invitationsLoading,
    invitationsError,
    queryErrors,
    refetchInvitations
  }
}
