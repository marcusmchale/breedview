import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import TEAMS_ROOTS_QUERY from '@/graphql/teams/teamsRoots.graphql'

// The root teams of every team tree visible to the user
export function useTeamRootsQuery() {
  const {
    result,
    loading: teamRootsLoading,
    error: teamRootsError,
    refetch: refetchTeamRoots
  } = useQuery(TEAMS_ROOTS_QUERY, {}, { fetchPolicy: 'cache-and-network' })

  const teamRoots = computed(() => result.value?.teamsRoots?.result ?? [])

  return {
    teamRoots,
    teamRootsLoading,
    teamRootsError,
    refetchTeamRoots
  }
}
