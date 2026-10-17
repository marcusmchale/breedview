// How a Person appears to the viewer: full record, restricted (id only) or erased (tombstone)
export function personForm(person) {
  if (!person) return 'missing'
  if (person.erased) return 'erased'
  if (person.restricted) return 'restricted'
  return 'full'
}

// Text to credit a Person with, e.g. "Name (Institution)"
export function personLabel(person) {
  switch (personForm(person)) {
    case 'full':
      return person.institution ? `${person.name} (${person.institution})` : person.name
    case 'restricted':
      return `Restricted person #${person.id}`
    case 'erased':
      return `Erased person #${person.id}`
    default:
      return 'Unknown person'
  }
}

// Who did something (a write, a commit): the account where the viewer may see it, otherwise its Person
export function writerLabel({ user, person }) {
  if (user) return user.name
  if (person) return personLabel(person)
  return 'An account without a Person record'
}

export function orcidUrl(orcid) {
  if (!orcid) return null
  return orcid.startsWith('http') ? orcid : `https://orcid.org/${orcid}`
}

export const LAWFUL_BASIS_OPTIONS = [
  { value: 'PUBLIC_TASK', label: 'Public task', description: 'Research by a public body, e.g. a university' },
  { value: 'LEGITIMATE_INTEREST', label: 'Legitimate interest', description: 'Research by a private partner' }
]

/**
 * The name a team reference (TeamReference) is shown by: the team's, or for a team hidden from the viewer,
 * "a team in" the nearest team they can see that includes it, which is whom to ask for access
 */
export function teamReferenceName({ team, standIn }, { full = false } = {}) {
  const name = (full && team.fullname) || team.name
  return standIn ? `a team in ${name}` : name
}

/** The names of a Person's teams as the viewer may see them */
export function personTeamNames(person, options = {}) {
  return (person?.teams ?? []).map((reference) => teamReferenceName(reference, options))
}

// A contribution as credited, e.g. "Name (Institution) — Investigation, Data curation"
export function contributionLabel({ person, roles }) {
  const names = (roles ?? []).map((role) => role?.name).filter(Boolean)
  return names.length ? `${personLabel(person)} — ${names.join(', ')}` : personLabel(person)
}

// Contributions as read ({ person, roles }) to their input ({ personId, roleIds }); a Person the API could not
// resolve is left out
export const contributionsInput = (contributions) => (contributions ?? [])
  .filter((contribution) => contribution?.person)
  .map((contribution) => ({
    personId: String(contribution.person.id),
    roleIds: (contribution.roles ?? []).map((role) => String(role.id))
  }))

// The same contributions in any order, as one string to compare
export const contributionsKey = (contributions) => JSON.stringify(
  [...(contributions ?? [])]
    .map(({ personId, roleIds }) => [String(personId), [...(roleIds ?? [])].map(String).sort()])
    .sort((a, b) => a[0].localeCompare(b[0]))
)

// The CRediT roles that fit each kind of record (breedgraph docs/front-end-changes.md §14), offered first
export const SUGGESTED_ROLES = {
  dataset: ['Investigation', 'Data curation', 'Methodology', 'Resources', 'Validation', 'Supervision'],
  program: ['Conceptualization', 'Funding acquisition', 'Project administration', 'Supervision'],
  reference: ['Formal analysis', 'Visualization', 'Writing – original draft', 'Writing – review & editing', 'Software', 'Data curation']
}
