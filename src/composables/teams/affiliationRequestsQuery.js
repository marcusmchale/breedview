import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import AFFILIATION_REQUESTS_QUERY from '@/graphql/teams/affiliationRequests.graphql'
import { useUserAccess } from '@/composables/user/useUserAccess'

const ACCESS_LEVELS = ['read', 'write', 'curate', 'admin']

const nameOf = (item) => item.fullname || item.name || ''

// Requests to join the teams the user administers, by team and then user: { team, user, access, heritable }.
// A request is a team's own affiliation that is still REQUESTED. Only direct affiliations are read: a heritable
// request is also among the inherited affiliations of every team below the one it was made to.
export function useAffiliationRequestsQuery() {
  const { adminTeamIds } = useUserAccess()

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
        .filter((affiliation) => affiliation.authorisation === 'REQUESTED')
        .map((affiliation) => ({
          team,
          user: affiliation.user,
          access: access.toUpperCase(),
          heritable: affiliation.heritable
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
