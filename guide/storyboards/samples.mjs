// Chapter 15, "Samples in the lab" (src/guide/chapters/samples.md), independent (manifest workflows.lab): Lena opens the
// arrival of the 2025 trial's 48 grain samples at the Grain Quality Laboratory, adds a flour subsample of each, derives
// seedlings on the Glasshouse benches for a germination check, moves the grain to a box in the Sample Freezer, and ends a
// flour sample used up. Plays from a fresh load of the demonstration database.
import { byText, chooseInTree, expandLocation, locationHeader, navLink } from '../lib/storyboard.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'samples',
  // the laboratory's scientist, of the Grain Quality Lab, signed in off camera
  account: 'lena'
}

const ROOTS = 'query ($locations: [ID!]!) { unitsArrivals(locationIds: $locations) { result { start unitCount pendingUnitCount } } }'

export async function check ({ page, session, manifest }) {
  const lab = manifest.workflows?.lab
  if (!lab) throw new Error('The build has no lab workflow')
  const { result } = await session.graphql(page, ROOTS, { locations: [String(manifest.entities[lab.arrival.location].id)] })
  const arrival = result.find((a) => a.start === lab.arrival.start)
  if (!arrival || arrival.pendingUnitCount !== lab.arrival.units) throw new Error('The grain samples are not all pending at the laboratory: load the dump again')
}

const modal = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`
const trigger = (n) => `document.querySelectorAll('.modal .hierarchical-select .select-trigger')[${n}]`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const lab = manifest.workflows.lab
  const name = (key) => manifest.entities[key].name
  const farm = name('farm')
  const laboratory = name(lab.arrival.location)
  const flour = 'NF25-101 grain flour'
  const submitted = async (what) => {
    await page.waitFor(`!document.querySelector('.modal') || ${modal('.error-message')}`, 60000)
    const error = await page.evaluate(`${modal('.error-message')}?.innerText ?? null`)
    if (error) throw new Error(`${what}: ${error}`)
  }
  const action = (label) => byText('.arrival-actions button', label)
  const arrivalItem = `[...document.querySelectorAll('.arrival-item')].find((i) => i.innerText.includes(${q(lab.arrival.start)}))`
  const where = (place) => ['Ireland', 'County Offaly', farm, ...place]

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('arrival', async () => {
    await input.click(navLink('Units'))
    await page.waitFor(`${locationHeader('Ireland')}?.querySelector('.expand-btn')`, 30000)
    await expandLocation({ page, input, name: 'Ireland' })
    await expandLocation({ page, input, name: 'County Offaly' })
    await expandLocation({ page, input, name: farm })
    await input.click(`${locationHeader(laboratory)}.querySelector('.location-name')`)
    await page.waitFor(arrivalItem, 30000)
    await input.pause(1200)
    await input.click(arrivalItem)
    await page.waitFor(`document.querySelector('.arrival-tree .arrival-unit') && ${action('Add children…')}`, 30000)
    await input.pause(1000)
    await input.hover('document.querySelector(".arrival-heading")', 2000)
    await input.hover('document.querySelector(".arrival-tree .arrival-unit")', 2500)
  })

  await step('children', async () => {
    await input.click(action('Add children…'))
    await page.waitFor(`[...(${modal('select[name=subjectId]')})?.options ?? []].some((o) => o.text.trim() === 'Flour sample')`, 15000)
    await input.pause(800)
    await input.choose(modal('select[name=subjectId]'), 'Flour sample')
    await input.type(modal('input[name=name]'), '{parent} flour')
    await page.waitFor(`${modal('.example')}?.innerText.includes(${q(flour)})`, 10000)
    await input.type(modal('input[name=start]'), '2025-09-02')
    await input.hover(modal('.example'), 1500)
    await input.click(modal('button[type=submit]'))
    await submitted('The flour samples were not added')
    await input.pause(1500)
  })

  await step('derive', async () => {
    await input.click(action('Derive…'))
    await page.waitFor(trigger(0), 15000)
    await input.pause(800)
    await chooseInTree({ page, input, trigger: trigger(0), path: where([name(lab.glasshouse)]) })
    await page.waitFor(`${trigger(2)} && !${trigger(2)}.classList.contains('disabled')`, 15000)
    await chooseInTree({ page, input, trigger: trigger(2), path: ['Glasshouse benches'] })
    await page.waitFor(modal('input[name=coordinate_0]'), 10000)
    await input.type(modal('input[name=coordinate_0]'), 'East')
    await input.type(modal('input[name=start]'), '2025-09-05')
    await input.choose(modal('select[name=subjectId]'), 'Seedling')
    await input.choose(modal('select[name=stage]'), 'Seed: seed, or a seed lot')
    await input.type(modal('input[name=description]'), 'Germination check')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted('The seedlings were not derived')
    await input.pause(1500)
  })

  await step('move', async () => {
    await input.click(action('Move on…'))
    await page.waitFor(trigger(0), 15000)
    await input.pause(800)
    await chooseInTree({ page, input, trigger: trigger(0), path: where([laboratory, name(lab.freezer)]) })
    await page.waitFor(`${trigger(1)} && !${trigger(1)}.classList.contains('disabled')`, 15000)
    await chooseInTree({ page, input, trigger: trigger(1), path: ['Freezer 1'] })
    await page.waitFor(modal('input[name=coordinate_1]'), 10000)
    await input.type(modal('input[name=coordinate_0]'), '1')
    await input.type(modal('input[name=coordinate_1]'), 'NF25 grain')
    await input.type(modal('input[name=start]'), '2025-09-10')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted('The grain samples were not moved')
    await input.pause(1500)
    await input.hover('document.querySelector(".tree-panel .notice")', 2000)
    await input.hover('document.querySelector(".arrival-heading")', 2000)
  })

  await step('end', async () => {
    // the flour sample, below its grain
    const grain = `${byText('.arrival-tree .node-name', flour.replace(/ flour$/, ''))}?.closest('.node-header')`
    await page.waitFor(`(${grain})?.querySelector('.expand-btn')`, 30000)
    await input.click(`(${grain}).querySelector('.expand-btn')`)
    const node = `${byText('.arrival-tree .node-name', flour)}?.closest('.node-header')`
    await page.waitFor(node, 30000)
    await input.pause(800)
    await input.click(node)
    const card = (selector) => `document.querySelector(${q(`.card-panel .details-card ${selector}`)})`
    await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(flour)}`, 30000)
    await input.pause(1000)
    await input.click(byText('.card-panel .details-card .card-actions button', 'End…'))
    await page.waitFor(modal('input[name=end]'), 15000)
    await input.pause(800)
    await input.type(modal('input[name=end]'), '2025-09-20')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted(`${flour} was not ended`)
    await page.waitFor(`[...document.querySelectorAll('.card-panel .details-card .section-title')].some((t) => /ended/i.test(t.textContent))`, 30000)
    await input.pause(1000)
    await input.hover(card('.position-info'), 3000)
    recorder.poster()
  })
}
