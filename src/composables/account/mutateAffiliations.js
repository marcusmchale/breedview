import { useMutation } from '@vue/apollo-composable'

import APPROVE_AFFILIATION_MUTATION from '@/graphql/account/approveAffiliation.graphql'
import REVOKE_AFFILIATION_MUTATION from '@/graphql/account/revokeAffiliation.graphql'

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
