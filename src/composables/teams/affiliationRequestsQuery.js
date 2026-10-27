import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import AFFILIATION_REQUESTS_QUERY from '@/graphql/teams/affiliationRequests.graphql'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useAuthStore } from '@/composables/user/useAuthStore'

const ACCESS_LEVELS = ['read', 'write', 'curate', 'admin']

const nameOf = (item) => item.fullname || item.name || ''

// Requests to the teams the user administers, by team and then user: { team, user, access, heritable, held }.
// A request is a team's own affiliation that is still REQUESTED, or one authorised for the team only that its user
// asked to make heritable (held: they keep it meanwhile). Only direct affiliations are read: a heritable request is
// also among the inherited affiliations of every team below the one it was made to. The user's own requests are left
// out: an admin's is authorised as it is made, unless it is heritable and they may not approve that.
export function useAffiliationRequestsQuery() {
  const { adminTeamIds } = useUserAccess()
  const { currentUserId } = useAuthStore()

  const {
    result,
    loading: affiliationRequestsLoading,
    error: affiliationRequestsError,
    refetch: refetchAffiliationRequests
  } = useQuery(
    AFFILIATION_REQUESTS_QUERY,
    () => ({ teamIds: adminTeamIds.value }),
    () => ({ fetchPolicy: 'cache-and-network', enabled: adminTeamIds.value.length > 0 })
  )

  const affiliationRequests = computed(() => {
    // a disabled query keeps its last result, so a user who no longer administers a team would still see its requests
    const teams = adminTeamIds.value.length > 0 ? result.value?.teamsTeams?.result ?? [] : []
    return teams
      .flatMap((team) => ACCESS_LEVELS.flatMap((access) => (team.directAffiliations?.[access] ?? [])
        .filter((affiliation) => affiliation.authorisation === 'REQUESTED' || affiliation.heritableRequested)
        .filter((affiliation) => String(affiliation.user.id) !== String(currentUserId.value))
        .map((affiliation) => ({
          team,
          user: affiliation.user,
          access: access.toUpperCase(),
          heritable: affiliation.heritable || affiliation.heritableRequested,
          held: affiliation.authorisation === 'AUTHORISED'
        }))))
      .sort((a, b) => nameOf(a.team).localeCompare(nameOf(b.team)) || nameOf(a.user).localeCompare(nameOf(b.user)))
  })

  return {
    affiliationRequests,
    affiliationRequestsLoading,
    affiliationRequestsError,
    refetchAffiliationRequests
  }
}
