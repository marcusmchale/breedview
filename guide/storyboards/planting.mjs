// Chapter 14, "Planting a trial" (src/guide/chapters/planting.md), the last of the next-season chain (manifest
// chains.next_season, guide/data/next-season.mjs): Theo starts the Hill Field 2027 trial area's unit graph at Hill
// Field, adds its 18 plots, then gives HF27-1 its germplasm and its place in Block 1 on camera, and the other plots
// theirs off camera, as hillFieldPlots plans them. Plays on from the plant-material chapter.
import { byText, chooseInTree, expandLocation, locationHeader, pickerOption } from '../lib/storyboard.mjs'
import { hillFieldPlots, nextSeason, SOWN } from '../data/next-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'planting',
  // the field technician, of Field Operations, signed in off camera
  account: 'theo'
}

export async function check ({ page, session, manifest }) {
  const state = await nextSeason({ page, session, manifest })
  if (!state.cross) throw new Error(`${manifest.chains.next_season.cross.name} does not exist yet: play the plant-material chapter first`)
  if (state.area) throw new Error(`${manifest.chains.next_season.area} exists already: load the dump again`)
}

const modal = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`
const card = (selector) => `document.querySelector(${q(`.card-panel .details-card ${selector}`)})`
const node = (name) => `${byText('.tree-panel .node-name', name)}?.closest('.node-header')`
const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const UNITS = 'query ($ids: [ID!]) { unitsUnits(ids: $ids) { result { id name children { id name } } } }'

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const plan = manifest.chains.next_season
  const farm = manifest.entities[plan.field.parent]?.name ?? 'Example Research Farm'
  const team = manifest.teams.field.name
  const plots = hillFieldPlots(manifest)
  const [first] = plots
  const germplasmName = (key) => manifest.entities[key].name
  const submitted = async (what) => {
    await page.waitFor(`!document.querySelector('.modal') || ${modal('.error-message')}`, 60000)
    const error = await page.evaluate(`${modal('.error-message')}?.innerText ?? null`)
    if (error) throw new Error(`${what}: ${error}`)
  }

  await recorder.hold(async () => {
    await page.goto(`${app}/units`)
    await page.waitFor(`${locationHeader('Ireland')}?.querySelector('.expand-btn')`, 30000)
    await page.sleep(1500)
  })
  await input.restoreCursor()

  await step('graph', async () => {
    await expandLocation({ page, input, name: 'Ireland' })
    await expandLocation({ page, input, name: 'County Offaly' })
    await expandLocation({ page, input, name: farm })
    await input.click(`${locationHeader(plan.field.name)}.querySelector('.location-name')`)
    await page.waitFor(`document.querySelector('.blocks-box .btn-add-unit')`, 30000)
    await input.pause(1200)
    await input.click('document.querySelector(".blocks-box .btn-add-unit")')
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    await page.waitFor(`[...(${modal('select[name=subjectId]')}).options].some((o) => o.text.trim() === 'Field')`, 15000)
    await input.choose(modal('select[name=subjectId]'), 'Field')
    await input.type(modal('input[name=name]'), plan.area)
    await input.type(modal('input[name=description]'), 'The 2027 yield trial: six entries in three blocks')
    await input.hover(modal('.form-section'), 1200)
    await input.type(modal('input[name=positionStart]'), SOWN)
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted(`${plan.area} was not added`)
    const listed = byText('.blocks-box .block-item .block-name', plan.area)
    await page.waitFor(listed, 15000)
    await input.pause(800)
    await input.click(listed)
    await page.waitFor(node(plan.area), 15000)
    await input.pause(1200)
  })

  await step('plots', async () => {
    await input.click(byText('.tree-actions button', 'Add children…'))
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    // the trial area, from the units at Hill Field
    await page.waitFor(`document.querySelector('.modal .hierarchical-multiselect .select-trigger:not(.disabled)')`, 15000)
    await input.click('document.querySelector(".modal .hierarchical-multiselect .select-trigger")')
    await page.waitFor(`${levelLoaded} && ${pickerOption(plan.area)}`, 30000)
    await input.pause(600)
    await input.click(`${pickerOption(plan.area)}.querySelector('.option-checkbox')`)
    await input.pause(500)
    await input.click('document.querySelector(".dropdown-panel .btn-done")')
    await page.waitFor(`!document.querySelector('.dropdown-panel')`, 10000)
    await page.waitFor(`[...(${modal('select[name=subjectId]')}).options].some((o) => o.text.trim() === 'Plot')`, 15000)
    await input.choose(modal('select[name=subjectId]'), 'Plot')
    await input.type(modal('input[name=count]'), String(plots.length))
    await input.type(modal('input[name=name]'), `${plan.field.code}27-{n}`)
    await page.waitFor(`${modal('.example')}?.innerText.includes(${q(first.name)})`, 10000)
    await input.hover(modal('.example'), 1500)
    // Taken on emptied: undated, the plots stay where the trial area is until each is placed in its block
    await input.click(modal('input[name=start]'))
    await page.evaluate(`${modal('input[name=start]')}.select()`)
    await input.key('Backspace')
    await input.pause(600)
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted('The plots were not added')
    // the trial area, open to its plots
    const toggle = `(${node(plan.area)})?.querySelector('.expand-btn')`
    await page.waitFor(toggle, 30000)
    if (!(await page.evaluate(`${toggle}.classList.contains('expanded')`))) await input.click(toggle)
    await page.waitFor(node(first.name), 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".tree-panel")', 2000)
  })

  await step('germplasm', async () => {
    await input.click(node(first.name))
    await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(first.name)}`, 30000)
    await input.pause(1200)
    await input.click(byText('.card-panel .details-card .card-actions button', '✏️ Edit'))
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    await chooseInTree({ page, input, trigger: `${modal('.hierarchical-select .select-trigger')}`, path: ['Wheat', germplasmName(first.germplasm)] })
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted(`${first.name}'s germplasm was not set`)
    await page.waitFor(`${card('.card-content')}?.innerText.includes(${q(germplasmName(first.germplasm))})`, 30000)
    await input.pause(800)
    await input.hover(card('.fields-grid'), 2000)
  })

  await step('position', async () => {
    await input.click(card('.btn-add-position'))
    await page.waitFor(modal('input[name=start]'), 15000)
    await input.pause(800)
    // the form's pickers: its location, then its layout
    const locationTrigger = 'document.querySelectorAll(".modal .hierarchical-select .select-trigger")[0]'
    const layoutTrigger = 'document.querySelectorAll(".modal .hierarchical-select .select-trigger")[1]'
    if (!(await page.evaluate(`${locationTrigger}.innerText.includes(${q(plan.field.name)})`))) {
      await chooseInTree({ page, input, trigger: locationTrigger, path: ['Ireland', 'County Offaly', farm, plan.field.name] })
    }
    await chooseInTree({ page, input, trigger: layoutTrigger, path: [plan.layout, `Block ${first.block}`] })
    await page.waitFor(modal('input[name=coordinate_1]'), 10000)
    await input.type(modal('input[name=coordinate_0]'), String(first.row))
    await input.type(modal('input[name=coordinate_1]'), String(first.column))
    await input.type(modal('input[name=start]'), SOWN)
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted(`${first.name} was not placed`)
    await page.waitFor(`${card('.position-info')}?.innerText.includes('Block ${first.block}')`, 30000)
    await input.pause(800)
    await input.hover(card('.position-info'), 2500)

    // the other plots, as their sheet gives them
    await recorder.offCamera(async () => {
      const { field, layout, area } = await nextSeason({ page, session, manifest })
      const { result: [graph] } = await session.graphql(page, UNITS, { ids: [area.id] })
      const ids = Object.fromEntries(graph.children.map((child) => [child.name, child.id]))
      const blocks = Object.fromEntries(layout.children.map((block) => [block.name, block.id]))
      for (const plot of plots.slice(1)) {
        const updated = await session.graphql(page, 'mutation ($unit: UnitUpdate!) { unitsUpdateUnit(unit: $unit) { status errors { message } } }', {
          unit: { id: ids[plot.name], germplasmId: String(manifest.entities[plot.germplasm].id) }
        })
        const placed = await session.graphql(page, 'mutation ($id: ID!, $position: PositionInput!) { unitsAddPosition(id: $id, position: $position) { status errors { message } } }', {
          id: ids[plot.name],
          position: { locationId: field.id, layoutId: blocks[`Block ${plot.block}`], coordinates: [String(plot.row), String(plot.column)], start: SOWN }
        })
        for (const result of [updated, placed]) {
          if (result.status !== 'SUCCESS') throw new Error(`${plot.name}: ${JSON.stringify(result.errors)}`)
        }
      }
    }, { label: `Later: ${plots.length - 1} more plots, each with its entry and place` })
  })

  await step('planted', async () => {
    const last = plots.at(-1)
    // down the tree's panel, which scrolls, to the last plot
    const inPanel = `(() => { const r = (${node(last.name)}).getBoundingClientRect(), p = document.querySelector('.tree-panel').getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom })()`
    for (let i = 0; i < 10 && !(await page.evaluate(inPanel)); i++) await input.scroll('document.querySelector(".tree-panel")', 360)
    await input.click(node(last.name))
    await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(last.name)} && ${card('.position-info')}?.innerText.includes('Block ${last.block}')`, 30000)
    await input.pause(1000)
    await input.hover('document.querySelector(".tree-panel")', 2000)
    recorder.poster()
    await input.hover(card('.position-info'), 2500)
  })
}
