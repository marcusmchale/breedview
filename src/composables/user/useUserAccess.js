import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import USER_ACCESS_QUERY from '@/graphql/account/userAccess.graphql'

export function useUserAccess(options= {} ) {
  const { result, loading, error , onResult, onError} = useQuery(
      USER_ACCESS_QUERY,
      {},
      {
        fetchPolicy: "cache-and-network",
        ...options
      }
  )

  const userAccess = computed(() => result.value?.accountsUserAccess?.result || null)

  const readTeams = computed(() => userAccess.value?.read || [])
  const writeTeams = computed(() => userAccess.value?.write || [])
  const adminTeams = computed(() => userAccess.value?.admin || [])
  const curateTeams = computed(() => userAccess.value?.curate || [])

  const readTeamIds = computed(() => readTeams.value.map(t => t.id))
  const writeTeamIds = computed(() => writeTeams.value.map(t => t.id))
  const adminTeamIds = computed(() => adminTeams.value.map(t => t.id))
  const curateTeamIds = computed(() => curateTeams.value.map(t => t.id))

  return {
    userAccess,
    loading,
    error,
    onResult,
    onError,
    readTeams,
    writeTeams,
    adminTeams,
    curateTeams,
    readTeamIds,
    writeTeamIds,
    adminTeamIds,
    curateTeamIds
  }
}