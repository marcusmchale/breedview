import { useMutation } from '@vue/apollo-composable'

import APPROVE_AFFILIATION_MUTATION from '@/graphql/account/approveAffiliation.graphql'
import REVOKE_AFFILIATION_MUTATION from '@/graphql/account/revokeAffiliation.graphql'
import REQUEST_AFFILIATION_MUTATION from '@/graphql/account/requestAffiliation.graphql'
import REMOVE_HERITABILITY_MUTATION from '@/graphql/account/removeHeritability.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

const unwrap = (response, field) => {
  const payload = response?.data?.[field]
  return payload ? { status: payload.status, errors: payload.errors } : noResponse
}

// Decisions by a team's admins on other users' affiliations to it. Revoking a request rejects it: the user may ask again.
export function useMutateAffiliations() {
  const { mutate: approveMutation, loading: approveAffiliationLoading } = useMutation(APPROVE_AFFILIATION_MUTATION)
  const { mutate: revokeMutation, loading: revokeAffiliationLoading } = useMutation(REVOKE_AFFILIATION_MUTATION)

  const approveAffiliation = async ({ userId, teamId, access, heritable = false }) =>
    unwrap(await approveMutation({ user: userId, team: teamId, access, heritable }), 'accountsApproveAffiliation')
  const revokeAffiliation = async ({ userId, teamId, access }) =>
    unwrap(await revokeMutation({ user: userId, team: teamId, access }), 'accountsRevokeAffiliation')

  return {
    approveAffiliation,
    approveAffiliationLoading,
    revokeAffiliation,
    revokeAffiliationLoading
  }
}

// A user's changes to the reach of their own affiliation to a team. Asking for one held to the team only to reach the
// teams below too goes to the team's admins, and the user keeps it meanwhile; keeping one to the team only, or
// withdrawing that request, takes effect at once.
export function useMutateOwnAffiliations() {
  const { mutate: requestMutation, loading: requestHeritabilityLoading } = useMutation(REQUEST_AFFILIATION_MUTATION)
  const { mutate: removeMutation, loading: removeHeritabilityLoading } = useMutation(REMOVE_HERITABILITY_MUTATION)

  const requestHeritability = async ({ teamId, access }) =>
    unwrap(await requestMutation({ team: teamId, access, heritable: true }), 'accountsRequestAffiliation')
  const removeHeritability = async ({ teamId, access }) =>
    unwrap(await removeMutation({ team: teamId, access }), 'accountsRemoveHeritability')

  return {
    requestHeritability,
    requestHeritabilityLoading,
    removeHeritability,
    removeHeritabilityLoading
  }
}
