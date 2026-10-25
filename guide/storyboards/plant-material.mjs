// Chapter 13, "Plant material" (src/guide/chapters/plant-material.md), the third of the next-season chain (manifest
// chains.next_season, guide/data/next-season.mjs): Bridget records the cross EPB 26-X01, of EPB 25-S03 (maternal) by
// EPB 21-022 (paternal), made by hand crossing; finds it in the pedigree graph with its parents beside it; then follows
// EPB 25-S03's card to the 2025 plant it was selected from (manifest workflows.lab.selection). Plays on from the places
// chapter; the planting chapter goes on from it.
import { byText, clearOf, gatherLinked } from '../lib/storyboard.mjs'
import { nextSeason } from '../data/next-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'plant-material',
  // the breeder, of the Wheat Breeding Group, signed in off camera
  account: 'bridget'
}

export async function check ({ page, session, manifest }) {
  const state = await nextSeason({ page, session, manifest })
  if (!state.layout) throw new Error('Hill Field has no layout yet: play the places chapter first')
  if (state.cross) throw new Error(`${manifest.chains.next_season.cross.name} exists already: load the dump again`)
}

const modal = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`
const graph = { nodes: '.germplasm-network-graph circle', links: '.germplasm-network-graph line', frame: '.germplasm-network-graph svg' }
const node = (name) => `[...document.querySelectorAll('.germplasm-network-graph circle')].find((c) => c.__data__?.name === ${q(name)})`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.chains.next_season.cross
  const maternal = manifest.entities[plan.maternal].name
  const paternal = manifest.entities[plan.paternal].name
  const selection = manifest.workflows.lab.selection
  const selected = manifest.entities[selection.germplasm].name
  const team = manifest.teams.breeding.name
  const source = (index, which) => `[...document.querySelectorAll('.modal .relationship-item')][${index}]?.querySelectorAll('.relationship-fields select')[${which}]`
  // an entry found with the graph's search, which centres it
  const find = async (name) => {
    await input.type('document.querySelector(".search-box .search-input")', name)
    await page.waitFor(byText('.search-result-item .result-name', name), 15000)
    await input.click(byText('.search-result-item .result-name', name))
    await page.waitFor(node(name), 15000)
    await input.pause(2000)
  }

  await recorder.hold(async () => {
    await page.goto(`${app}/germplasm`)
    await page.waitFor(`document.querySelector('.germplasm-header .btn-primary') && document.querySelector('.search-box .search-input') && document.querySelector('.germplasm-network-graph circle')`, 30000)
    await page.sleep(3000)
  })
  await input.restoreCursor()

  await step('entry', async () => {
    await input.click(byText('.germplasm-header button', 'Create New Entry'))
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    await input.type(modal('input[name=name]'), plan.name)
    await input.type(modal('textarea[name=description]'), `A cross of ${maternal} by ${paternal}, made in the glasshouse for the 2027 trials`)
    await input.type(modal('input[name=time]'), '2026-04')
    await input.choose(modal('select[name=reproduction]'), 'Sexual')
    await input.click(`[...(${modal('select[name=controlMethodIds]')}).options].find((o) => o.text.trim() === 'Hand crossing')`)
    await input.pause(600)
    for (const [index, [parent, type]] of [[maternal, 'MATERNAL'], [paternal, 'PATERNAL']].entries()) {
      await input.click(byText('.modal button', '+ Add Source'))
      await page.waitFor(source(index, 1), 10000)
      await input.choose(source(index, 0), parent)
      await input.choose(source(index, 1), type)
      await input.pause(500)
    }
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(1000)
    await input.click(modal('button[type=submit]'))
    await page.waitFor(`!document.querySelector('.modal') || ${modal('.error-message')}`, 30000)
    const error = await page.evaluate(`${modal('.error-message')}?.innerText ?? null`)
    if (error) throw new Error(`${plan.name} was not created: ${error}`)
    await input.pause(1500)
  })

  await step('graph', async () => {
    await find(plan.name)
    const cross = node(plan.name)
    await input.drag(cross, { by: await clearOf(page, { node: cross, ...graph, margin: 170 }) })
    await input.pause(1200)
    await gatherLinked({ page, input, node: cross, ...graph, radius: 150 })
    await input.pause(2500)
    recorder.poster()
  })

  await step('selection', async () => {
    await find(selected)
    await input.click(node(selected))
    const unit = `[...document.querySelectorAll('.details-card-container .field')].find((f) => f.querySelector('.field-label')?.textContent.trim() === 'Unit')?.querySelector('a')`
    await page.waitFor(unit, 15000)
    // down to the card, with the wheel in the page's margin: over the graph it zooms
    await input.scroll(null, 500, { at: { x: 1262, y: 560 } })
    await input.pause(1200)
    await input.hover(unit, 1800)
    await input.click(unit)
    await page.waitFor(`[...document.querySelectorAll('.details-card h2')].some((h) => h.innerText.trim() === ${q(selection.plant)})`, 30000)
    await input.pause(1500)
    await input.hover(`[...document.querySelectorAll('.details-card h2')].find((h) => h.innerText.trim() === ${q(selection.plant)})`, 2500)
  })
}
