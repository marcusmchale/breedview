// Chapter 12, "Sites, fields and layouts" (src/guide/chapters/places.md), the second of the next-season chain (manifest
// chains.next_season, guide/data/next-season.mjs): Theo adds Hill Field to the farm, draws its boundary from the
// manifest and saves it, then lays out the Hill Field 2027 trial: a tree of the Field trial blocks type with Block 1, a
// plot grid, added on camera, and Blocks 2 and 3 off camera. Plays on from the describing chapter; the plant-material
// chapter goes on from it.
import { byText, expandLocation, locationHeader } from '../lib/storyboard.mjs'
import { nextSeason } from '../data/next-season.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'places',
  // the field technician, of Field Operations, signed in off camera
  account: 'theo'
}

export async function check ({ page, session, manifest }) {
  const state = await nextSeason({ page, session, manifest })
  if (!state.variable) throw new Error('Flag leaf length (cm) does not exist yet: play the describing chapter first')
  if (state.field) throw new Error('Hill Field exists already: load the dump again')
}

const modal = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`
// the location's card, and the selected layout's, below the layouts
const locationCard = (selector) => `document.querySelector(${q(`.regions-content > .card-panel ${selector}`)})`
const layoutCard = (selector) => `document.querySelector(${q(`.location-layouts-panel .card-panel ${selector}`)})`

export async function run ({ page, input, recorder, step, manifest, app }) {
  const plan = manifest.chains.next_season
  const farm = manifest.entities[plan.field.parent]?.name ?? 'Example Research Farm'
  const team = manifest.teams.field.name
  const submitted = async (what) => {
    await page.waitFor(`!document.querySelector('.modal') || ${modal('.error-message')}`, 30000)
    const error = await page.evaluate(`${modal('.error-message')}?.innerText ?? null`)
    if (error) throw new Error(`${what} was not added: ${error}`)
  }
  const treeNode = (name) => `${byText('.location-layouts-panel .tree-panel .node-name', name)}?.closest('.node-header')`
  // a block of the trial, from the trial's card
  const addBlock = async (block) => {
    await input.click(treeNode(plan.layout))
    await page.waitFor(`${layoutCard('h2')}?.innerText.trim() === ${q(plan.layout)} && ${layoutCard('.btn-add-child')}`, 15000)
    await input.click(layoutCard('.btn-add-child'))
    await page.waitFor(modal('input[name=position_0]'), 15000)
    await input.pause(600)
    await input.type(modal('input[name=position_0]'), String(block))
    await input.type(modal('input[name=name]'), `Block ${block}`)
    await input.choose(modal('select[name=typeId]'), 'Plot grid')
    await page.waitFor(modal('input[name=axis_1]'), 10000)
    await input.type(modal('input[name=axis_0]'), 'Row')
    await input.type(modal('input[name=axis_1]'), 'Column')
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await submitted(`Block ${block}`)
    await openTrial()
    await page.waitFor(treeNode(`Block ${block}`), 15000)
  }
  // the trial's node in the tree, open to its blocks
  const openTrial = async () => {
    const toggle = `(${treeNode(plan.layout)})?.querySelector('.expand-btn')`
    await page.waitFor(toggle, 15000)
    if (!(await page.evaluate(`${toggle}.classList.contains('expanded')`))) await input.click(toggle)
  }

  await recorder.hold(async () => {
    await page.goto(`${app}/locations`)
    await page.waitFor(`document.querySelector('.leaflet-container') && ${locationHeader('Ireland')}?.querySelector('.expand-btn')`, 30000)
    await page.sleep(1500)
  })
  await input.restoreCursor()

  await step('field', async () => {
    await expandLocation({ page, input, name: 'Ireland' })
    await expandLocation({ page, input, name: 'County Offaly' })
    await input.click(`${locationHeader(farm)}.querySelector('.location-name')`)
    await page.waitFor(`${locationCard('h2')}?.innerText.trim() === ${q(farm)} && ${locationCard('.btn-add-child')}`, 30000)
    await input.pause(2500)
    await input.click(locationCard('.btn-add-child'))
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    await input.choose(modal('select[name=typeId]'), 'Field')
    await input.type(modal('input[name=name]'), plan.field.name)
    await input.type(modal('input[name=code]'), plan.field.code)
    await input.type(modal('[name=description]'), plan.field.description)
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Public')
    await input.pause(1000)
    await input.click(modal('button[type=submit]'))
    await submitted(plan.field.name)
    await input.pause(1200)
    // the farm's fields, the new one among them
    await page.waitFor(`${locationHeader(farm)}?.querySelector('.expand-btn')`, 15000)
    if (!(await page.evaluate(`!!${locationHeader(plan.field.name)}`))) await expandLocation({ page, input, name: farm })
    await page.waitFor(locationHeader(plan.field.name), 15000)
    await input.click(`${locationHeader(plan.field.name)}.querySelector('.location-name')`)
    await page.waitFor(`${locationCard('h2')}?.innerText.trim() === ${q(plan.field.name)}`, 30000)
    await input.pause(2000)
  })

  await step('boundary', async () => {
    await input.click(`document.querySelector('.leaflet-pm-icon-polygon')?.closest('a, .button-container')`)
    await input.pause(800)
    const corners = plan.field.boundary
    for (const corner of [...corners, corners[0]]) {
      await input.clickAt(await input.mapPoint(corner.latitude, corner.longitude))
      await input.pause(500)
    }
    await page.waitFor(locationCard('.drawn-shape .btn-save'), 15000)
    await input.pause(1000)
    await input.hover(locationCard('.drawn-shape-text'), 1800)
    await input.click(locationCard('.drawn-shape .btn-save'))
    await page.waitFor(`!${locationCard('.drawn-shape')} && ${locationCard('.coord-pair')}`, 30000)
    await input.pause(1000)
    await input.hover(locationCard('.list'), 1800)
    // the saved boundary, which the map now fits
    await input.hover('document.querySelector(".map-panel .leaflet-container")', 2500)
  })

  await step('layout', async () => {
    await input.click(`document.querySelector('.location-layouts-panel .btn-add-layout')`)
    await page.waitFor(modal('input[name=name]'), 15000)
    await input.pause(800)
    await input.type(modal('input[name=name]'), plan.layout)
    await input.choose(modal('select[name=typeId]'), 'Field trial blocks')
    await page.waitFor(modal('input[name=axis_0]'), 10000)
    await input.type(modal('input[name=axis_0]'), 'Block')
    await input.choose(modal('.control-selector .selector-item:nth-child(1) select'), team)
    await input.choose(modal('.control-selector .selector-item:nth-child(2) select'), 'Private')
    await input.pause(1000)
    await input.click(modal('button[type=submit]'))
    await submitted(plan.layout)
    const listed = byText('.location-layouts-panel .layout-item .layout-name', plan.layout)
    await page.waitFor(listed, 15000)
    await input.pause(800)
    await input.click(listed)
    await page.waitFor(treeNode(plan.layout), 15000)
    await input.pause(1200)
  })

  await step('block', async () => {
    await addBlock(1)
    await input.pause(1200)
    await recorder.offCamera(async () => {
      await addBlock(2)
      await addBlock(3)
    }, { label: 'Later: Blocks 2 and 3' })
  })

  await step('ready', async () => {
    await openTrial()
    await page.waitFor(treeNode('Block 3'), 15000)
    await input.pause(800)
    await input.hover(`document.querySelector('.location-layouts-panel .tree-panel')`, 2500)
    recorder.poster()
    await input.click(treeNode('Block 1'))
    await page.waitFor(`${layoutCard('h2')}?.innerText.trim() === 'Block 1'`, 15000)
    await input.pause(800)
    await input.hover(layoutCard('.card-content'), 3000)
  })

}
