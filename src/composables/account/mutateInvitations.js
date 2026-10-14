import { useMutation } from '@vue/apollo-composable'

import INVITE_MUTATION from '@/graphql/account/invite.graphql'
import CANCEL_INVITATION_MUTATION from '@/graphql/account/cancelInvitation.graphql'
import RESEND_INVITATION_MUTATION from '@/graphql/account/resendInvitation.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

export function useMutateInvitations() {
  const { mutate: inviteMutation, loading: inviteLoading } = useMutation(INVITE_MUTATION)
  const { mutate: cancelMutation, loading: cancelInvitationLoading } = useMutation(CANCEL_INVITATION_MUTATION)
  const { mutate: resendMutation, loading: resendInvitationLoading } = useMutation(RESEND_INVITATION_MUTATION)

  // teams: [{ teamId, access }], personId: optional Person to offer for linking
  const invite = async ({ email, teams = [], personId = null }) => {
    const response = await inviteMutation({ email, teams, personId })
    const payload = response?.data?.accountsInvite
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const cancelInvitation = async (id) => {
    const response = await cancelMutation({ id })
    const payload = response?.data?.accountsCancelInvitation
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const resendInvitation = async (id) => {
    const response = await resendMutation({ id })
    const payload = response?.data?.accountsResendInvitation
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    invite,
    inviteLoading,
    cancelInvitation,
    cancelInvitationLoading,
    resendInvitation,
    resendInvitationLoading
  }
}
