import { useMutation } from '@vue/apollo-composable'

import REQUEST_CLAIM_MUTATION from '@/graphql/people/requestClaim.graphql'
import WITHDRAW_CLAIM_MUTATION from '@/graphql/people/withdrawClaim.graphql'
import APPROVE_CLAIM_MUTATION from '@/graphql/people/approveClaim.graphql'
import REJECT_CLAIM_MUTATION from '@/graphql/people/rejectClaim.graphql'
import UNLINK_PERSON_MUTATION from '@/graphql/people/unlinkPerson.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

const unwrap = (response, field) => {
  const payload = response?.data?.[field]
  return payload ? { status: payload.status, errors: payload.errors } : noResponse
}

// Linking accounts to Persons: requests by users, decisions by admins of the controlling teams, unlinking
export function useMutateClaims() {
  const { mutate: requestMutation, loading: requestClaimLoading } = useMutation(REQUEST_CLAIM_MUTATION)
  const { mutate: withdrawMutation, loading: withdrawClaimLoading } = useMutation(WITHDRAW_CLAIM_MUTATION)
  const { mutate: approveMutation, loading: approveClaimLoading } = useMutation(APPROVE_CLAIM_MUTATION)
  const { mutate: rejectMutation, loading: rejectClaimLoading } = useMutation(REJECT_CLAIM_MUTATION)
  const { mutate: unlinkMutation, loading: unlinkPersonLoading } = useMutation(UNLINK_PERSON_MUTATION)

  const requestClaim = async (personId) =>
    unwrap(await requestMutation({ personId }), 'peopleRequestClaim')
  const withdrawClaim = async (personId) =>
    unwrap(await withdrawMutation({ personId }), 'peopleWithdrawClaim')
  const approveClaim = async ({ personId, userId }) =>
    unwrap(await approveMutation({ personId, userId }), 'peopleApproveClaim')
  const rejectClaim = async ({ personId, userId }) =>
    unwrap(await rejectMutation({ personId, userId }), 'peopleRejectClaim')
  const unlinkPerson = async (personId) =>
    unwrap(await unlinkMutation({ personId }), 'peopleUnlinkPerson')

  return {
    requestClaim,
    requestClaimLoading,
    withdrawClaim,
    withdrawClaimLoading,
    approveClaim,
    approveClaimLoading,
    rejectClaim,
    rejectClaimLoading,
    unlinkPerson,
    unlinkPersonLoading
  }
}
