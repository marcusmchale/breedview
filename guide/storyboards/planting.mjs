// Chapter 14, "Planting a trial" (src/guide/chapters/planting.md), the last of the next-season chain (manifest
// chains.next_season, guide/data/next-season.mjs): Theo starts the Hill Field 2027 trial area's unit graph at Hill
// Field and adds its 18 plots, then places them all from the field sheet with Place units…: their entries and places,
// as hillFieldPlots plans them, pasted on the first plot's name. Plays on from the plant-material chapter.
import { byText, chooseInTree, chooseUnlessChosen, expandLocation, locationHeader, pickerOption } from '../lib/storyboard.mjs'
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
const row = (name) => `[...document.querySelectorAll('.placement-table tbody tr')].find((tr) => tr.querySelector('.unit-name').value === ${q(name)})`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.chains.next_season
  const farm = manifest.entities[plan.field.parent]?.name ?? 'Example Research Farm'
  const team = manifest.teams.field.name
  const plots = hillFieldPlots(manifest)
  const [first] = plots
  const germplasmName = (key) => manifest.entities[key].name
  const control = async (team, release) => {
    await chooseUnlessChosen({ page, input, select: modal('.control-selector .selector-item:nth-child(1) select'), option: team })
    await chooseUnlessChosen({ page, input, select: modal('.control-selector .selector-item:nth-child(2) select'), option: release })
  }
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
    await control(team, 'Private')
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
    await control(team, 'Private')
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

  await step('sheet', async () => {
    await input.click(byText('.tree-actions button', 'Place units…'))
    await page.waitFor(modal('.hierarchical-multiselect'), 15000)
    // the trial area's plots, chosen at first
    await page.waitFor(`document.querySelector('.modal .hierarchical-multiselect')?.innerText.includes(${q(plots.at(-1).name)})`, 30000)
    await input.pause(1200)
    const layoutTrigger = `[...document.querySelectorAll('.modal .formkit-outer')].find((o) => o.querySelector('label')?.innerText.includes('Layout'))?.querySelector('.select-trigger')`
    await chooseInTree({ page, input, trigger: layoutTrigger, path: [plan.layout] })
    await input.type(modal('input[name=start]'), SOWN)
    await page.waitFor(`document.querySelectorAll('.placement-table tbody tr').length === ${plots.length}`, 30000)
    await input.pause(1200)
    await input.hover(modal('.placement-table thead'), 1500)
    const sheet = [
      'Plot\tEntry\tBlock\tRow\tColumn',
      ...plots.map((plot) => [plot.name, germplasmName(plot.germplasm), plot.block, plot.row, plot.column].join('\t'))
    ].join('\n')
    await input.paste(`${row(first.name)}.querySelector('.unit-name')`, sheet, { heading: 'Copied from the field sheet: plot, entry, block, row and column' })
    const last = plots.at(-1)
    await page.waitFor(`${row(last.name)}?.querySelector('.status-column').innerText.includes('Block ${last.block}')`, 30000)
    await input.pause(800)
    await input.hover(`${row(first.name)}.querySelector('.status-column')`, 2500)
    recorder.poster()
  })

  await step('save', async () => {
    await input.hover(modal('.place-summary'), 1800)
    await input.click(modal('button[type=submit]'))
    await submitted('The plots were not placed')
    await page.waitFor(`document.querySelector('.notice')?.innerText.includes(${q(`Placed ${plots.length} units`)})`, 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".notice")', 2000)
  })

  await step('planted', async () => {
    await input.restoreCursor()
    const last = plots.at(-1)
    // the trial area, open to its plots
    const toggle = `(${node(plan.area)})?.querySelector('.expand-btn')`
    await page.waitFor(toggle, 30000)
    if (!(await page.evaluate(`${toggle}.classList.contains('expanded')`))) await input.click(toggle)
    await page.waitFor(node(last.name), 30000)
    // down the tree's panel, which scrolls, to the last plot
    const inPanel = `(() => { const r = (${node(last.name)}).getBoundingClientRect(), p = document.querySelector('.tree-panel').getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom })()`
    for (let i = 0; i < 10 && !(await page.evaluate(inPanel)); i++) await input.scroll('document.querySelector(".tree-panel")', 360)
    await input.click(node(last.name))
    await page.waitFor(`${card('h2')}?.innerText.trim() === ${q(last.name)} && ${card('.position-info')}?.innerText.includes('Block ${last.block}')`, 30000)
    await input.pause(1000)
    await input.hover('document.querySelector(".tree-panel")', 2000)
    await input.hover(card('.position-info'), 2500)
  })
}
