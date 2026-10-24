// The curation table: a record's 🔒 opens its dataset's controller in full, with its controls and writes, for a
// signed-in user, who reads the record; a visitor is shown no controllers and none is asked for; rows come in the
// order of their units' ids, compared as numbers (as text, 10 came before 2); and the Rows choice lays out a unit's
// records by year, each value with its own time, or one per record, whose time can be edited.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entity, concept, perf, manifest, licences, positions } from './lib/fixture.mjs'

let browser, page
const q = JSON.stringify

before(async () => { browser = await launchBrowser({ height: 1600 }); page = browser.page })
after(async () => { await browser?.close() })

const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
const option = (label) => `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim().startsWith(${q(label)}))`

// Open curation from the programs page and choose a study through its program and trial, and a variable
async function curate (path, study, variable) {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`document.querySelector('.programs-header .view-datasets')`, 30000)
  await page.click('.programs-header .view-datasets')
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  for (const label of path) {
    await page.waitFor(`${levelLoaded} && ${option(label)}?.querySelector('.expand-button')`, 60000)
    await page.evaluate(`${option(label)}.querySelector('.expand-button').click()`)
    await page.sleep(300)
  }
  await page.waitFor(`${levelLoaded} && ${option(study)}?.querySelector('.option-checkbox')`, 60000)
  await page.evaluate(`${option(study)}.querySelector('.option-checkbox').click()`)
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 120000)
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]'); [...s.options].forEach((o) => { o.selected = o.text.trim() === ${q(variable)} }); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`, 30000)
  // a licensed study's licence, accepted when asked for, as a visitor must
  await page.sleep(1000)
  if (await page.exists('input[name=licencesAgreed]')) {
    await page.check('input[name=licencesAgreed]', true)
    await page.click('.licence-agreement button.accept-licences')
    await page.waitFor(`!document.querySelector('input[name=licencesAgreed]')`, 30000)
  }
  const loadTable = `[...document.querySelectorAll('.selection-actions button')].find((e) => e.innerText.includes('Load Table'))`
  await page.waitFor(`!${loadTable}.disabled`, 30000)
  await page.evaluate(`${loadTable}.click()`)
  await page.waitFor(`document.querySelector('.curation-table tbody tr td')`, 120000)
  await page.sleep(1000)
}

const publicStudy = () => curate([entity('program').name, entity('trial').name], entity('study_public').name, concept)
const controllerModal = `[...document.querySelectorAll('.modal')].find((m) => m.innerText.includes('Controller Details'))`

test("a record's 🔒 shows its dataset's controller, with its controls and writes", async () => {
  await loginAs(page, 'writer')
  try {
    await publicStudy()
    await page.waitFor(`document.querySelector('.controller-badge-mini')`)
    await page.evaluate(`document.querySelector('.controller-badge-mini').click()`)
    await page.waitFor(`${controllerModal}?.innerText.includes('Write History')`, 20000)
    const text = await page.evaluate(`${controllerModal}.innerText`)
    assert.ok(text.includes('Controls:'), 'the controls are shown')
    assert.ok(!text.includes("You can't read this record"), 'the record is not taken for one the writer cannot read')
  } finally {
    await logout(page)
  }
})

test('a visitor is shown no controllers, and none is asked for', async () => {
  const mark = page.mark()
  // the licensed study is public, through its program and trial, as study_public's are not
  await curate([licences.program.name, licences.trial.name], licences.studies.public.name, concept)
  assert.equal(await page.evaluate(`document.querySelectorAll('.controller-badge-mini').length`), 0)
  const controllerRequests = page.graphql(mark).filter((request) => request.op.startsWith('controlsController'))
  assert.deepEqual(controllerRequests, [], 'no controller is asked for')
  // nor anything else a visitor is refused, such as recent files: only the sign-in check, which says they are not
  const refused = (await page.graphqlErrors(mark)).filter((failure) => !failure.startsWith('accountsAccount:'))
  assert.deepEqual(refused, [], 'no request is refused')
})

// the scale study's first page of units, whose ids run past a power of ten; a database built without --scale has none
const scale = manifest.scale?.names

test('rows come in unit id order', { skip: !scale && 'the test database was built without --scale' }, async () => {
  await loginAs(page, 'admin')
  try {
    await curate([scale.scale_program, scale.scale_trial], perf.study, perf.concept)
    // the table draws only the rows in view: scroll through it, collecting each unit id as its row is drawn
    const ids = await page.evaluate(`(async () => {
      const wrapper = document.querySelector('.table-wrapper'), seen = new Map()
      for (let top = 0; top <= wrapper.scrollHeight; top += wrapper.clientHeight / 2) {
        wrapper.scrollTop = top
        await new Promise((resolve) => setTimeout(resolve, 150))
        for (const row of wrapper.querySelectorAll('tbody tr:not(.section-header):not(.spacer-row)')) {
          // a unit's rows (its records at several times) count once, where first drawn: rows are drawn top down
          const unit = row.querySelectorAll('td')[0]?.innerText.trim(), id = Number(row.querySelectorAll('td')[1]?.innerText.trim())
          if (unit && !Number.isNaN(id) && !seen.has(id)) seen.set(id, unit)
        }
      }
      return [...seen.keys()]
    })()`)
    assert.ok(ids.length > 1, 'rows are shown')
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), 'the unit ids are in order')
    assert.ok(new Set(ids.map((id) => String(id).length)).size > 1, `the ids shown run past a power of ten (${ids[0]}..${ids.at(-1)})`)
  } finally {
    await logout(page)
  }
})

// The positions study's heights (breedgraph tests/breedgraph/scenarios/position_scenario.py): Moved Tree measured in
// 2023 and 2024, each Greenhouse Plant on 2024-04-01 and 2024-06-01, the other trees once on 2024-06-01
const HEIGHT = 'Tree Height (mm)'
const setRows = async (mode) => {
  await page.evaluate(`(() => { const s = document.querySelector('select[name=rowMode]'); s.value = ${q(mode)}; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.sleep(500)
}
const rowModeLocked = () => page.evaluate(`document.querySelector('select[name=rowMode]').disabled`)
// the rows of a unit as drawn: { start, end, value, title } (Unit, Unit ID, Start, End, then the height)
const rowsOf = (unit) => page.evaluate(`[...document.querySelectorAll('.curation-table tbody tr:not(.section-header):not(.spacer-row)')]
  .filter((tr) => tr.querySelector('td')?.innerText.trim() === ${q(unit)})
  .map((tr) => { const cells = tr.querySelectorAll('td'); return { start: cells[2].innerText.trim(), end: cells[3].innerText.trim(),
    value: cells[4].querySelector('.cell-value')?.innerText.trim(), title: cells[4].title } })`)
const cellOf = (unit, n, column) => `[...document.querySelectorAll('.curation-table tbody tr:not(.section-header):not(.spacer-row)')]
  .filter((tr) => tr.querySelector('td')?.innerText.trim() === ${q(unit)})[${n}].querySelectorAll('td')[${column}]`
const enter = async (selector, value) => {
  await page.waitFor(`document.querySelector(${q(selector)})`)
  await page.type(selector, value)
  await page.evaluate(`document.querySelector(${q(selector)}).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)
  await page.sleep(300)
}
const save = async () => {
  await page.click('.table-footer .btn-primary')
  await page.waitFor(`document.querySelector('.table-footer .saved-note') && !document.querySelector('.table-footer .btn-primary:not([disabled])')`, 60000)
}
const heights = async () => Object.fromEntries((await graphql(page,
  'query ($ids: [ID!]!) { datasets(ids: $ids) { result { records { value start end unit { name } } } } }',
  { ids: [String(positions.datasets.height)] })).result[0].records.map((r) => [`${r.unit.name} ${r.value}`, [r.start, r.end]]))

test("rows: by year a unit's records of a year share a row; one per record, a record's own time is edited",
  { skip: !positions && 'the test database was built before the positions study' }, async () => {
    await loginAs(page, 'writer')
    const mark = page.mark()
    try {
      await curate([positions.program.name, positions.trial.name], positions.study.name, HEIGHT)

      await setRows('year')
      assert.deepEqual((await rowsOf('Moved Tree')).map((r) => [r.start, r.value]), [['2023', '105'], ['2024', '303']])
      // a second height of a year can't share its row: the earlier first, each with its own time in its title
      assert.deepEqual(await rowsOf('Greenhouse Plant 1'), [
        { start: '2024', end: '', value: '400', title: 'Recorded 2024-04-01' },
        { start: '2024', end: '', value: '410', title: 'Recorded 2024-06-01' }
      ])
      // a row by year's times can't be edited
      await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 2)}.querySelector('.time-cell-display').click()`)
      assert.equal(await page.exists('.time-cell-input'), false, 'no time is edited by year')

      // the export keeps every record's own time, whatever the view
      await page.evaluate(`(() => { const create = URL.createObjectURL; window.__exported = null;
        URL.createObjectURL = (blob) => { blob.text().then((text) => { window.__exported = text }); return create.call(URL, blob) } })()`)
      await page.evaluate(`[...document.querySelectorAll('.toolbar button')].find((b) => b.innerText.includes('Export')).click()`)
      await page.waitFor(`window.__exported`)
      const exported = (await page.evaluate('window.__exported')).split('\n').filter((line) => line.startsWith('Greenhouse Plant 1,'))
      assert.deepEqual(exported.map((line) => line.split(',').slice(2, 5)), [['2024-04-01', '', '400'], ['2024-06-01', '', '410']])

      // one per record: Greenhouse Plant 1's first height given a day later, saved, and set back
      await setRows('record')
      assert.deepEqual((await rowsOf('Greenhouse Plant 1')).map((r) => [r.start, r.value]), [['2024-04-01', '400'], ['2024-06-01', '410']])
      for (const day of ['2024-04-02', '2024-04-01']) {
        await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 2)}.querySelector('.time-cell-display').click()`)
        await enter('.time-cell-input', day)
        assert.ok(await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 2)}.classList.contains('time-changed')`), 'the start is changed')
        assert.equal(await rowModeLocked(), true, 'the rows stay as they are while a change is unsaved')
        await save()
        assert.deepEqual((await heights())['Greenhouse Plant 1 400'], [day, null], `the record starts on ${day}`)
        assert.deepEqual((await heights())['Greenhouse Plant 1 410'], ['2024-06-01', null], 'the other record keeps its time')
        assert.equal(await rowModeLocked(), false, 'saved, the rows can be laid out again')
      }
      // an end before the start is refused
      await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 3)}.querySelector('.time-cell-display').click()`)
      await enter('.time-cell-input', '2024-03-01')
      assert.equal(await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 3)}.title`), 'The end is before the start')
      await page.evaluate(`${cellOf('Greenhouse Plant 1', 0, 3)}.querySelector('.time-cell-display').click()`)
      await enter('.time-cell-input', '')

      // by year, a value changed and saved keeps its record's own time
      await setRows('year')
      for (const value of ['421', '420']) {
        await page.evaluate(`${cellOf('Greenhouse Plant 2', 0, 4)}.querySelector('.cell-value').click()`)
        await enter('.cell-input', value)
        await save()
        assert.deepEqual((await heights())[`Greenhouse Plant 2 ${value}`], ['2024-04-01', null], `${value} keeps the record's time`)
        assert.equal(await rowModeLocked(), false, 'saved, the rows can be laid out again')
      }
      assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
    } finally {
      await logout(page)
    }
  })
