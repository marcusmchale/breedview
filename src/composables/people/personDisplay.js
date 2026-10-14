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
