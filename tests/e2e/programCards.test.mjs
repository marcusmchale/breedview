// A trial's card shows its full name only where it differs from its name: breedgraph gives a trial created with no full
// name its name as one. As the admin, who curates the organisation's public program, two trials are created in it,
// one without a full name and one with; they are deleted afterwards.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const PLAIN = 'E2E trial named once'
const NAMED = { name: 'E2E trial with a full name', fullname: 'E2E trial with a full name of its own' }

let browser, page
const trialIds = async () => (await graphql(page, 'query { programs { result { trials { id name } } } }')).result
  .flatMap((program) => program.trials).filter((trial) => [PLAIN, NAMED.name].includes(trial.name)).map((trial) => trial.id)
const removeTrials = async () => {
  for (const id of await trialIds()) {
    await graphql(page, 'mutation ($id: ID!) { programsDeleteTrial(id: $id) { status } }', { id })
  }
}

before(async () => {
  browser = await launchBrowser(); page = browser.page
  await loginAs(page, 'admin')
  await removeTrials()
})
after(async () => {
  try {
    await removeTrials()
  } finally {
    await logout(page); await browser?.close()
  }
})

test("a trial's full name is shown only where it differs from its name", async () => {
  for (const trial of [{ name: PLAIN }, NAMED]) {
    const payload = await graphql(page, `mutation ($trial: TrialInput!, $team: ID!) {
      programsCreateTrial(trial: $trial, controlTeamId: $team, release: PUBLIC) { status errors { message } } }`,
    { trial: { programId: String(e.program_public.id), ...trial }, team: String(teams.root.id) })
    assert.equal(payload.status, 'SUCCESS', q(payload.errors))
  }
  const stored = (await graphql(page, 'query { programs { result { trials { name fullname } } } }')).result
    .flatMap((program) => program.trials).find((trial) => trial.name === PLAIN)
  assert.equal(stored.fullname, PLAIN, 'breedgraph names it in full by its name')

  await page.goto(`${config.appUrl}/programs`)
  const program = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(e.program_public.name)})`
  await page.waitFor(`${program}?.querySelector('.trials-header')`, 30000)
  await page.evaluate(`${program}.querySelector('.trials-header').click()`)
  const card = (name) => `[...${program}.querySelectorAll('.trial-card')].find((c) => c.querySelector('.trial-title-section')?.innerText.trim() === ${q(name)})`
  const fullName = (name) => page.evaluate(`[...(${card(name)}).querySelectorAll('.trial-content > p')].find((p) => p.innerText.startsWith('Full Name:'))?.innerText ?? null`)
  await page.waitFor(`${card(PLAIN)}?.querySelector('.trial-content') && ${card(NAMED.name)}?.querySelector('.trial-content')`, 30000)
  assert.equal(await fullName(PLAIN), null, 'no full name repeating the name')
  assert.equal(await fullName(NAMED.name), `Full Name: ${NAMED.fullname}`)
})
