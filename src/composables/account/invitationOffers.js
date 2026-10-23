// The accesses an invitation can offer to a team, in the order the app lists them
export const ACCESS_LEVELS = ['READ', 'WRITE', 'ADMIN', 'CURATE']

const byLevel = (a, b) => ACCESS_LEVELS.indexOf(a) - ACCESS_LEVELS.indexOf(b)

// "read", "read and write", "read, write and curate"
export function describeAccesses(accesses) {
  const words = [...accesses].sort(byLevel).map((access) => access.toLowerCase())
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

// An invitation's offers, one for each access to a team, grouped by team as the invited user accepts them (every
// access offered to a team they accept): [{ teamId, teamName, accesses }]. The accessors read the team of an offer,
// as invitation previews (teamId, teamName) and the inviter's pending invitations (team { id, name }) give it.
export function offersByTeam(offers, { teamId = (offer) => offer.teamId, teamName = (offer) => offer.teamName } = {}) {
  const teams = new Map()
  for (const offer of offers ?? []) {
    const id = teamId(offer)
    const team = teams.get(id) ?? { teamId: id, teamName: teamName(offer), accesses: [] }
    team.accesses.push(offer.access)
    teams.set(id, team)
  }
  return [...teams.values()]
}
