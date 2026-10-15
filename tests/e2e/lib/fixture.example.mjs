// The entities of the dev database the e2e tests use. Copy this file to fixture.local.mjs, which is not committed,
// and fill in the ids and names of the database the tests run against. The values below are placeholders: the
// structure each needs is described alongside. The entities are released or kept private by lib/partialAccess.mjs
// (npm run e2e:partial); each readable entity is separated from the next by a hidden one.

// Released by level. Anonymous users see the public ones only.
export const releasedTo = {
  PUBLIC: {
    Study: [0],            // a study below a private trial and program
    Dataset: [0, 0],       // a dataset of that study with one record for each tree of the field below; and a dataset of
                           // another study whose records cite the private data file reference in `hidden`
    Unit: [0],             // the field unit those trees are in
    Location: [0],         // the field's location, below two private regions, in a public country
    Reference: [0],        // a data file reference, cited by a private dataset
    Germplasm: [0, 0],     // an entry and its hybrid below the private crop in `hidden`
    Person: [0]            // the contributor to the first dataset
  },
  REGISTERED: {
    Unit: [0]              // one tree in the field's private block
  },
  PRIVATE: {
    Germplasm: [0]         // a public entry made private, between two public entries of the public crop
  }
}

// What restoreReleases sets back, for entities the fixture changed from a release other than private
export const originally = { PUBLIC: { Germplasm: [0] } }

// Everything registered users can read in the study, its dataset and their units and locations
export const released = {
  Study: [0],
  Dataset: [0],
  Unit: [0, 0],            // the field and the registered-only tree
  Location: [0]
}

// Kept private: the tests rely on them being hidden
export const hidden = {
  Program: [0],
  Trial: [0],
  Unit: [0, 0],            // the field's block, and another tree in it
  Location: [0, 0],        // the two regions above the field's location
  Reference: [0],          // the data file cited by the second public dataset's records
  Germplasm: [0, 0],       // the private crop, and the other parent of the public hybrid
  Person: [0]              // the contributor to the second public dataset
}

// Persons: one public, one private and a contributor to a public dataset; the partial account's own Person is created
// in `team` (where the admin writes) as a member of `ownTeam` (which the partial account cannot see)
export const people = {
  public: 0, publicName: 'Public Contributor', hidden: 0, hiddenName: 'Private Contributor', contributedTo: 0,
  ownName: 'Partial Access Tester', team: 0, ownTeam: 0
}

// Germplasm: a hidden crop holding public entries, and a hidden entry between two public ones of a public crop
export const germplasm = {
  hiddenCrop: 0, publicUnderCrop: [0, 0], hybrid: 0, publicParent: 0, hiddenParent: 0,
  hiddenMiddle: 0, above: 0, below: 0, publicCrop: 0
}

// References: one public, one private and cited by a public dataset's records, with their files in the file store
export const references = {
  public: 0, hidden: 0, citedBy: 0, description: 'a word in both references\' descriptions',
  publicFile: '00000000-0000-0000-0000-000000000000', hiddenFile: '00000000-0000-0000-0000-000000000000'
}

// Names the tests look for on the pages
export const names = {
  program: 'Program', trial: 'Trial', study: 'Study', field: 'Field', block: 'Block', tree: 'Tree',
  location: 'Field location', hiddenLocations: ['Region', 'Subregion'], country: 'Country',
  organisation: 'Organisation'  // the visible team that includes the hidden team, standing in for it
}

// The team below the organisation that controls the data, which the admin administers without write or curate access
export const hiddenTeam = { id: 0, name: 'Hidden Team' }

// A public germplasm entry the admin recorded, for write attribution
export const adminGermplasm = { id: 0, name: 'Public Crop' }

// Names the germplasm tests look for: the public crop, an entry below the hidden crop, and the hidden middle entry
export const germplasmNames = { publicCrop: 'Public Crop', publicUnderCrop: 'Entry', hiddenMiddle: 'Hidden Entry' }

// The released dataset's concept, its number of recorded units (one record each), and another dataset of the same
// study that stays private
export const datasets = { concept: 'Concept', recordedUnits: 0, hiddenInStudy: 0 }

// Defaults for the perf scripts: a large study and one of its variables, and a large field
export const perf = { study: 'Study', concept: 'Variable', field: 'Field' }
