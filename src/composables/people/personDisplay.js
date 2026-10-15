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
