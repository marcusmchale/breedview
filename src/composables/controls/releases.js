// Release levels, narrowest first, as the backend's ReadRelease
export const RELEASES = ['PRIVATE', 'REGISTERED', 'PUBLIC']
export const RELEASE_LABELS = { PRIVATE: 'Private', REGISTERED: 'Registered', PUBLIC: 'Public' }

// The widest release of some labels: Persons are never shown to people who are not signed in
// (breedgraph docs/person.md §3), and the backend refuses a wider release
export const RELEASE_CEILINGS = { PERSON: 'REGISTERED' }

/** The releases entities of all these labels can be given */
export function releasesFor(labels) {
  const ceilings = [...new Set(labels)].map((label) => RELEASE_CEILINGS[label]).filter(Boolean)
  const widest = Math.min(RELEASES.length - 1, ...ceilings.map((release) => RELEASES.indexOf(release)))
  return RELEASES.slice(0, widest + 1)
}
