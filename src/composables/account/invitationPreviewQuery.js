import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import INVITATION_QUERY from '@/graphql/account/invitation.graphql'

// What an invitation offers, from the token in the registration link. Works without login.
export function useInvitationPreviewQuery(token) {
  const enabled = computed(() => !!toValue(token))

  const {
    result,
    loading: invitationLoading,
    error: invitationError
  } = useQuery(
    INVITATION_QUERY,
    () => ({ token: toValue(token) }),
    () => ({ enabled: enabled.value, fetchPolicy: 'no-cache' })
  )

  const invitation = computed(() => {
    const payload = result.value?.accountsInvitation
    return payload?.status === 'SUCCESS' ? payload.result : null
  })

  // The server's message when the token is invalid, expired or already used
  const invitationMessage = computed(() => {
    const payload = result.value?.accountsInvitation
    if (!payload || payload.status === 'SUCCESS') return null
    return payload.errors?.[0]?.message || 'This invitation is not valid.'
  })

  return {
    invitation,
    invitationMessage,
    invitationLoading,
    invitationError
  }
}
