// Chapter 4, "Setting up a trial and study" (src/guide/chapters/setting-up.md), the first of the this-season chain
// (manifest chains.this_season, guide/data/this-season.mjs): Bridget creates Advanced Yield Trial 2026 in the
// programme, with herself as its contact, then Long Meadow Yield Trial 2026 in it, controlled by the Wheat Breeding
// Group and released Private. Plays from a fresh load of the demonstration database, which has neither; the recording
// chapter goes on from it.
import { byText, startsWith } from '../lib/storyboard.mjs'
import { season } from '../data/this-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'setting-up',
  // the programme's lead, who curates it, signed in off camera
  account: 'bridget'
}

export async function check ({ page, session, manifest }) {
  if (!manifest.chains?.this_season) throw new Error('The build has no this_season chain')
  if ((await season({ page, session, manifest })).trial) throw new Error('The 2026 trial exists already: load the dump again')
}

const field = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.chains.this_season
  const programme = manifest.entities[plan.programme].name
  const bridget = manifest.accounts[plan.actors.set_up]
  const team = manifest.teams.breeding.name
  const programmeCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(programme)})`
  const trialCard = `[...(${programmeCard})?.querySelectorAll('.trial-card') ?? []].find((c) => c.querySelector('.trial-title-section')?.innerText.trim() === ${q(plan.trial.name)})`
  const studyCard = `[...(${trialCard})?.querySelectorAll('.study-card') ?? []].find((c) => c.querySelector('.study-title-section')?.innerText.trim() === ${q(plan.study.name)})`
  const submitted = async (what) => {
    await page.waitFor(`!document.querySelector('.modal') || document.querySelector('.modal .error-message')`, 30000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The ${what} was not created: ${error}`)
  }

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`${programmeCard}?.querySelector('.program-actions')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('trial', async () => {
    await input.hover(`(${programmeCard}).querySelector('.program-card-header')`, 1500)
    await input.click(byText('button', 'Create Trial', `(${programmeCard}).querySelector('.program-actions')`))
    await page.waitFor(field('input[name=name]'), 15000)
    await input.pause(800)
    await input.type(field('input[name=name]'), plan.trial.name)
    await input.type(field('input[name=start]'), plan.trial.start)
    await input.type(field('input[name=end]'), plan.trial.end)
    await input.hover(field('.date-inputs'), 1800)
    // her own person record, as the trial's contact
    await input.click(byText('.modal .contacts-field button', '+ Add Contacts'))
    await page.waitFor(field('.contacts-field .person-filter'), 15000)
    await input.type(field('.contacts-field .person-filter'), bridget.fullname.split(' ')[0])
    const option = `[...document.querySelectorAll('.modal .contacts-field .person-option')].find((o) => o.querySelector('.person-name')?.innerText.startsWith(${q(bridget.fullname)}))`
    await page.waitFor(option, 15000)
    await input.click(`(${option}).querySelector('input')`)
    await input.pause(600)
    await input.click(byText('.modal .contacts-field button', 'Done'))
    await input.pause(800)
    await input.click(byText('.modal form button[type=submit]', 'Create Trial'))
    await submitted('trial')
    await input.pause(1000)
  })

  await step('study', async () => {
    // the programme's trials, the new one among them
    if (!(await page.evaluate(`!!(${trialCard})`))) await input.click(`(${programmeCard}).querySelector('.trials-header')`)
    await page.waitFor(`(${trialCard})?.querySelector('.trial-actions')`, 30000)
    await input.pause(1000)
    await input.hover(`(${trialCard}).querySelector('.trial-header')`, 1200)
    await input.click(byText('button', 'Create Study', `(${trialCard}).querySelector('.trial-actions')`))
    await page.waitFor(field('input[name=name]'), 15000)
    await input.pause(800)
    await input.type(field('input[name=name]'), plan.study.name)
    await input.type(field('textarea[name=description]'), plan.study.description)
    await input.type(field('textarea[name=practices]'), plan.study.practices)
    await input.type(field('input[name=start]'), plan.study.start)
    await input.type(field('input[name=end]'), plan.study.end)
    await page.waitFor(`[...(${field('select[name=designId]')})?.options ?? []].some((o) => o.text.trim() === 'Randomised complete block')`, 15000)
    await input.choose(field('select[name=designId]'), 'Randomised complete block')
    await input.pause(800)
  })

  await step('control', async () => {
    await input.hover(field('.control-selector'), 1200)
    await input.choose(field('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(field('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(1200)
    await input.click(byText('.modal form button[type=submit]', 'Create Study'))
    await submitted('study')
    await input.pause(1000)
  })

  await step('ready', async () => {
    if (!(await page.evaluate(`!!(${studyCard})`))) await input.click(`(${trialCard}).querySelector('.studies-header')`)
    await page.waitFor(`(${studyCard})?.querySelector('.study-content')`, 30000)
    await input.pause(800)
    await input.hover(`(${studyCard}).querySelector('.study-content')`, 3500)
    recorder.poster()
    await input.hover(`(${trialCard}).querySelector('.trial-content')`, 2500)
    await input.click(startsWith('.section-toggle', '▶ Datasets', studyCard))
    await page.waitFor(`(${studyCard}).querySelector('.dataset-actions')`, 15000)
    await input.hover(`(${studyCard}).querySelector('.dataset-actions')`, 2500)
  })
}
