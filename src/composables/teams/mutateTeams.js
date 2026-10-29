import { useMutation } from '@vue/apollo-composable'

import UPDATE_TEAM_MUTATION from '@/graphql/teams/updateTeam.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

export function useMutateTeams() {
  const { mutate: updateMutation, loading: updateTeamLoading } = useMutation(UPDATE_TEAM_MUTATION)

  // A team's name, full name and attribution: fields left out are unchanged, and null or empty clears the full name
  // or the attribution. The caller reads the team again, as the teams below it may inherit the attribution.
  const updateTeam = async (team) => {
    const payload = (await updateMutation({ team }))?.data?.teamsUpdateTeam
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    updateTeam,
    updateTeamLoading
  }
}
