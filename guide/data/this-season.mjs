// The this-season chain (chapters setting-up, recording, checking and analysing, in that order, on one load of the
// demonstration database): the 2026 trial and study the manifest plans (chains.this_season), as each chapter finds
// them. Each storyboard's check refuses a stack that is not at its point in the chain.
const PROGRAMS = 'query { programs { result { name trials { name studies { id name } } } } }'
const RECORDS = 'query ($studies: [ID!], $concepts: [ID!]) { datasets(studyIds: $studies, conceptIds: $concepts) { result { id records { id unit { id } value } } } }'

/** The 2026 trial and study, as far as they exist: { trial, study }, each null until created */
export async function season ({ page, session, manifest }) {
  const plan = manifest.chains.this_season
  const programme = manifest.entities[plan.programme].name
  const { result } = await session.graphql(page, PROGRAMS)
  const trial = result.find((p) => p.name === programme)?.trials.find((t) => t.name === plan.trial.name) ?? null
  return { trial, study: trial?.studies.find((s) => s.name === plan.study.name) ?? null }
}

/** The study's records of an observation the chain plans (chains.this_season.observations), by plot name */
export async function recorded ({ page, session, manifest }, study, observation) {
  const plan = manifest.chains.this_season
  const concept = String(plan.observations[observation].concept_id)
  const { result } = await session.graphql(page, RECORDS, { studies: [String(study.id)], concepts: [concept] })
  const names = Object.fromEntries(plan.plots.map((plot) => [String(plot.unit_id), plot.name]))
  return Object.fromEntries(result.flatMap((dataset) => dataset.records).map((r) => [names[r.unit.id] ?? r.unit.id, r.value]))
}
