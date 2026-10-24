// Chapter 2, "Exploring a study's data" (src/guide/chapters/exploring-data.md): a visitor opens the public 2024 study's
// records, puts each plot on one row by year, sees the fungicide programme each plot inherits from the trial area, and
// adds the germplasm and location columns. Nothing is changed, so it plays from any load of the demonstration database
// (manifest workflows.visitor_tour).
import { byText, loadStudyData, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'exploring-data',
  // a visitor, whose Terms are accepted off camera, as in chapter 1
  account: null
}

export async function check ({ manifest }) {
  const tour = manifest.workflows.visitor_tour
  for (const key of [tour.programme, tour.trial, tour.study, tour.licence]) {
    if (!manifest.entities[key]?.readable_by.includes('anonymous')) throw new Error(`A visitor can't read ${key}`)
  }
}

export async function run ({ page, input, recorder, step, manifest, app }) {
  const names = Object.fromEntries(Object.entries(manifest.entities).map(([key, entity]) => [key, entity.name]))
  const tour = manifest.workflows.visitor_tour

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card .trials-header')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('open', async () => {
    const cards = await openStudy({ page, input, programme: names[tour.programme], trial: names[tour.trial], study: names[tour.study] })
    await input.pause(600)
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.view-datasets')`, 30000)
    await input.pause(800)
    await input.click(`${cards.studyCard}.querySelector('.view-datasets')`)
    await loadStudyData({
      page, input, hold: (accept) => recorder.offCamera(accept, { label: "The study's licence accepted" })
    })
    await input.pause(2500)
  })

  const plotRow = (name) => `[...document.querySelectorAll('.curation-table tbody tr')].find((tr) => tr.querySelector('td')?.innerText.trim() === ${q(name)})`
  const columnOf = (header) => `[...document.querySelectorAll('.curation-table thead th')].findIndex((th) => th.textContent.trim().startsWith(${q(header)}))`
  const cellOf = (row, header) => `(${plotRow(row)}).querySelectorAll('td')[${columnOf(header)}]`
  // the 2024 trial's first plot
  const firstPlot = Object.keys(manifest.units).filter((name) => name.startsWith('LM24-')).sort()[0]

  await step('rows', async () => {
    await input.choose('document.querySelector("select[name=rowMode]")', 'Same year')
    await input.pause(1500)
    await input.tooltip(cellOf(firstPlot, 'Plant height (cm)'), 2200)
    await input.tooltip(cellOf(firstPlot, 'Grain yield (t/ha)'), 2200)
  })

  await step('factors', async () => {
    await input.tooltip(`(${plotRow(firstPlot)}).querySelector('.applied-factor')`, 3500)
    await input.pause(800)
  })

  await step('columns', async () => {
    await input.click(byText('.column-toggles summary', 'Columns'))
    await input.pause(600)
    for (const label of ['Germplasm', 'Location']) {
      await input.click(`[...document.querySelectorAll('.column-menu label')].find((l) => l.innerText.trim() === ${q(label)})?.querySelector('input')`)
      await input.pause(500)
    }
    await input.click(byText('.column-toggles summary', 'Columns'))
    await input.pause(3500)
  })
}
