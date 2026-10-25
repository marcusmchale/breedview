// Chapter 11, "Describing what you measure" (src/guide/chapters/describing.md), the first of the next-season chain
// (manifest chains.next_season, guide/data/next-season.mjs): Dara drafts the trait Flag leaf length, the observation
// method Ruler on the flag leaf and the variable Flag leaf length (cm) on the existing Centimetres scale, shows the drafts
// alone, and commits them as a minor version with the ontology's licence and copyright. Plays from a fresh load of the
// demonstration database, which has none of them; the places chapter goes on from it.
import { byText, commitReference } from '../lib/storyboard.mjs'
import { nextSeason } from '../data/next-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'describing',
  // the ontology's admin, signed in off camera
  account: 'dara'
}

export async function check ({ page, session, manifest }) {
  if (!manifest.chains?.next_season) throw new Error('The build has no next_season chain')
  if ((await nextSeason({ page, session, manifest })).variable) throw new Error('Flag leaf length (cm) exists already: load the dump again')
}

const modal = 'document.querySelector(".modal-container")'
const field = (selector) => `${modal}?.querySelector(${q(selector)})`
const option = (name, text) => `[...(${field(`select[name=${name}]`)})?.options ?? []].find((o) => o.text.trim() === ${q(text)})`
const commitForm = (selector) => `document.querySelector(${q(`.form-modal ${selector}`)})`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.chains.next_season.ontology
  // the existing scale (manifest ontology.entries.scales.centimetres), by its name as the form lists it
  const scale = 'Centimetres'
  const entryButton = (label) => byText('.buttons-panel .entry-btn', label)
  const phase = (label) => byText('.phase-btn', label)
  const created = async (what) => {
    await page.waitFor(`!${modal} || ${field('.error-message')}`, 30000)
    const error = await page.evaluate(`${field('.error-message')}?.innerText ?? null`)
    if (error) throw new Error(`The ${what} was not created: ${error}`)
  }
  const create = async (label, fill, what) => {
    await input.click(entryButton(label))
    await page.waitFor(field('input[name=name]'), 15000)
    await input.pause(800)
    await fill()
    await input.pause(800)
    await input.click(field('.form-actions button[type=submit]'))
    await created(what)
    await input.pause(1200)
  }
  await recorder.hold(async () => {
    await page.goto(`${app}/ontology`)
    await page.waitFor(`${entryButton('Trait')} && document.querySelector('.latest-commit-info')`, 30000)
    await page.sleep(2500)
  })
  await input.restoreCursor()

  await step('trait', async () => {
    await input.hover('document.querySelector(".buttons-panel .section-title")', 1200)
    await create('Trait', async () => {
      await input.type(field('input[name=name]'), plan.trait)
      await input.type(field('textarea[name=description]'), 'The length of the flag leaf, the last leaf before the ear, from its collar to its tip')
      await input.click(option('subjectIds', 'Plant'))
    }, 'trait')
  })

  await step('method', async () => {
    await create('Observation Method', async () => {
      await input.type(field('input[name=name]'), plan.method)
      await input.type(field('textarea[name=description]'), 'A ruler laid along the flag leaf of the main tiller, read to the nearest centimetre')
      await input.choose(field('select[name=observationType]'), 'Measurement')
    }, 'observation method')
  })

  await step('variable', async () => {
    await create('Variable', async () => {
      await input.type(field('input[name=name]'), plan.variable)
      await page.waitFor(`${option('traitId', plan.trait)} && ${option('observationMethodId', plan.method)}`, 15000)
      await input.choose(field('select[name=traitId]'), plan.trait)
      await input.choose(field('select[name=observationMethodId]'), plan.method)
      await input.choose(field('select[name=scaleId]'), scale)
      await input.hover(field('select[name=scaleId]'), 1200)
    }, 'variable')
  })

  await step('drafts', async () => {
    // the draft phase alone, then every current entry again
    await input.click(phase('ACTIVE'))
    await input.pause(2500)
    await input.hover('document.querySelector(".ontology-network-graph")', 3500)
    recorder.poster()
    await input.click(phase('ACTIVE'))
    await input.pause(1500)
  })

  await step('commit', async () => {
    await input.click(byText('.btn-version', 'Commit Changes'))
    await page.waitFor(commitForm('select[name=versionChange]'), 15000)
    await input.pause(800)
    await input.choose(commitForm('select[name=versionChange]'), 'MINOR')
    await input.type(commitForm('textarea[name=comment]'), 'Add flag leaf length, for the 2027 trials')
    await commitReference({ page, input, button: 'Select Licence', description: 'Example Ontology Licence' })
    await commitReference({ page, input, button: 'Select Copyright', description: 'Example Ontology Copyright' })
    await input.hover(commitForm('.reference-section'), 1500)
    await input.click(commitForm('button[type=submit]'))
    await page.waitFor(`!document.querySelector('.form-modal')`, 30000)
    await page.waitFor(`document.querySelector('.latest-commit-info')?.innerText.includes('2.2.0')`, 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".latest-commit-info")', 2500)
  })

  await step('history', async () => {
    await input.click(byText('.btn-version', 'View History'))
    await page.waitFor(`document.querySelector('.commit-card')`, 30000)
    await input.pause(1200)
    await input.hover('document.querySelector(".commit-card")', 3000)
    await input.hover('document.querySelector(".commit-card .btn-display")', 1500)
  })
}
