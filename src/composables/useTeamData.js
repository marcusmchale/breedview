import { ref, computed } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import TEAMS_QUERY from '../graphql/organisations/teams.graphql'

export function useTeamData(initialTeamData, currentUserId) {
  const { client } = useApolloClient()
  
  // Reactive state
  const teamInfo = ref({ ...initialTeamData })
  const isExpanded = ref(false)
  const childrenData = ref([])
  const childrenLoading = ref(false)
  const childrenError = ref('')

  // Computed properties
  const hasChildren = computed(() => {
    return teamInfo.value.children?.length > 0
  })

  const userIsAdminForTeam = computed(() => {
    const userId = currentUserId

    // Function to check admin access recursively up the team hierarchy
    const checkAdminAccessRecursive = (team) => {
      if (!team) return false

      // Check direct admin affiliations on this team
      const adminAffiliations = team.affiliations?.admin || []
      const hasDirectAdmin = adminAffiliations.some(affiliation =>
        affiliation.user.id === userId && affiliation.authorisation === 'AUTHORISED'
      )

      if (hasDirectAdmin) return true

      // Check for heritable admin affiliations on parent team
      if (team.parent) {
        const parentAdminAffiliations = team.parent.affiliations?.admin || []
        const hasHeritableAdminFromParent = parentAdminAffiliations.some(affiliation =>
          affiliation.user.id === userId &&
          affiliation.authorisation === 'AUTHORISED' &&
          affiliation.heritable === true
        )

        if (hasHeritableAdminFromParent) return true

        // Recursively check up the hierarchy
        return checkAdminAccessRecursive(team.parent)
      }

      return false
    }

    return checkAdminAccessRecursive(teamInfo.value)
  })

  // Methods
  const loadChildren = async () => {
    if (!hasChildren.value) {
      childrenData.value = []
      return
    }

    childrenError.value = ''
    childrenData.value = []
    childrenLoading.value = true

    try {
      const childIds = teamInfo.value.children.map(child => child.id)

      const result = await client.query({
        query: TEAMS_QUERY,
        variables: { team_ids: childIds },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      })

      if (result?.data?.teams?.status === 'SUCCESS' && result.data.teams.result) {
        const sortedTeams = [...result.data.teams.result].sort((a, b) => a.id - b.id)
        childrenData.value = sortedTeams
        childrenError.value = ''
      } else {
        const errorMsg = result?.data?.teams?.errors?.[0]?.message || 'Failed to load children'
        childrenError.value = errorMsg
      }
    } catch (error) {
      console.error(`Failed to load children for team ${initialTeamData.id}:`, error)
      childrenError.value = error.message || 'Failed to load children'
    } finally {
      childrenLoading.value = false
    }
  }

  const refreshTeamData = async () => {
    try {
      const result = await client.query({
        query: TEAMS_QUERY,
        variables: { team_ids: [initialTeamData.id] },
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      })

      if (result?.data?.teams?.status === 'SUCCESS' && result.data.teams.result?.length > 0) {
        const freshData = result.data.teams.result[0]
        teamInfo.value = { ...freshData }
        return freshData
      }
    } catch (error) {
      console.error('Failed to refresh team data:', error)
    }
    return null
  }

  const toggleExpanded = async () => {
    if (!isExpanded.value) {
      // Expanding
      isExpanded.value = true
      await refreshTeamData()
      await loadChildren()
    } else {
      // Collapsing
      isExpanded.value = false
      childrenData.value = []
      childrenError.value = ''
    }
  }

  return {
    // State
    teamInfo,
    isExpanded,
    childrenData,
    childrenLoading,
    childrenError,
    
    // Computed
    hasChildren,
    userIsAdminForTeam,
    
    // Methods
    loadChildren,
    refreshTeamData,
    toggleExpanded
  }
}
