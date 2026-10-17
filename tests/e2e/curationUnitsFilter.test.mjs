// The units filter of the curation selection lists only units the selected datasets have records for, with counts.
// env: STUDY to prefer a study by name; otherwise the first study found is used.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout } from './lib/app.mjs'

const STUDY = process.env.STUDY || ''
let browser, page
before(async () => { browser = await launchBrowser(); page = browser.page; await login(page, config.adminUser, config.adminPassword) })
after(async () => { await logout(page); await browser?.close() })

const optionLabels = () => page.evaluate(`[...document.querySelectorAll('.options-list .option-label')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const levelLoaded = `!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`
const withAmount = /· [\d,]+ (units|records?)$/

test('the units filter offers the units the selected datasets have records for', async () => {
  await page.goto(`${config.appUrl}/programs`)
  await page.waitFor(`[...document.querySelectorAll('button')].some((e) => e.innerText.toLowerCase().includes('curat'))`, 30000)
  await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.toLowerCase().includes('curat')).click()`)
  await page.waitFor(`document.querySelector('.hierarchical-multiselect .select-trigger')`)
  await page.sleep(800)
  // a study: program -> trial -> study, the first at each level unless one matches STUDY
  await page.evaluate(`document.querySelector('.hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 30000)
  for (let level = 0; level < 3; level++) {
    if (!(await page.exists('.options-list .expand-button'))) break
    const labels = await optionLabels()
    const pick = Math.max(labels.findIndex((l) => l.includes(STUDY)), 0)
    await page.evaluate(`[...document.querySelectorAll('.options-list .expand-button')][${pick}].click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 30000)
  }
  const studies = await optionLabels()
  const study = Math.max(studies.findIndex((l) => l.includes(STUDY)), 0)
  await page.evaluate(`[...document.querySelectorAll('.options-list .option-checkbox')][${study}].click()`)
  // Done only once the picker has the study, and on only once it has closed: a click while it re-renders is lost,
  // leaving the study list open for the option labels read below
  await page.waitFor(`document.querySelector('.selection-count-text')?.innerText.trim().startsWith('1 selected')`)
  await page.click('.btn-done')
  await page.waitFor(`!document.querySelector('.options-list')`)
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 120000)
  // the first concept; the roots of the units filter are read as soon as datasets are selected
  let mark = page.mark()
  await page.evaluate(`(() => { const s = document.querySelector('select[name=variableIds]'); s.options[0].selected = true; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('.record-filters select[name=pageSize]')`)
  const hint = (await page.text('.datasets-hint')).trim()
  const records = Number(hint.match(/with ([\d,]+) records/)[1].replace(/,/g, ''))
  assert.ok(records > 0, `the selected datasets hold records: ${hint}`)

  // the roots of the units filter are the blocks with records, each with how much lies below it
  await page.evaluate(`document.querySelector('.record-filters .hierarchical-multiselect .select-trigger').click()`)
  await page.waitFor(levelLoaded, 60000)
  const roots = await optionLabels()
  assert.ok(roots.length > 0, 'at least one block has records')
  for (const label of roots) assert.match(label, withAmount, `a root shows what it holds: ${label}`)
  assert.ok(page.graphql(mark).some((r) => r.op === 'DatasetsUnits'), 'the roots come from the datasets units query')
  const unitsBelow = roots.map((l) => Number(l.match(/· ([\d,]+) units/)?.[1]?.replace(/,/g, '') ?? 1)).reduce((a, b) => a + b, 0)
  assert.ok(unitsBelow <= records, `no more units than records: ${unitsBelow} units, ${records} records`)

  // one level down: only the children with records, again with counts
  const openable = await page.exists('.options-list .expand-button')
  if (openable) {
    mark = page.mark()
    await page.evaluate(`document.querySelector('.options-list .expand-button').click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 60000)
    const children = await optionLabels()
    assert.ok(children.length > 0, 'the opened block lists the units with records under it')
    for (const label of children) assert.match(label, withAmount, `a child shows what it holds: ${label}`)
    const childUnits = children.map((l) => Number(l.match(/· ([\d,]+) units/)?.[1]?.replace(/,/g, '') ?? 1)).reduce((a, b) => a + b, 0)
    const rootUnits = Number(roots[0].match(/· ([\d,]+) units/)?.[1]?.replace(/,/g, '') ?? 1)
    assert.ok(childUnits <= rootUnits, `the children hold no more than their block: ${childUnits} under ${rootUnits}`)
    assert.ok(page.graphql(mark).some((r) => r.op === 'DatasetsUnits'), 'the level comes from the datasets units query')
    await page.evaluate(`[...document.querySelectorAll('.breadcrumb button.breadcrumb-item')].at(0).click()`)
    await page.sleep(300)
    await page.waitFor(levelLoaded, 60000)
  }

  // by type over everything: the recorded units by subject, and no more of them than records
  mark = page.mark()
  await page.click('.select-by-type-button')
  await page.waitFor(`document.querySelector('.type-row') || document.querySelector('.type-panel-error') || document.querySelector('.type-panel .empty-state')`, 60000)
  const rows = await page.evaluate(`[...document.querySelectorAll('.type-row')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.ok(rows.length > 0, `the recorded units are grouped by subject: ${await page.text('.type-panel')}`)
  const grouped = rows.map((r) => Number((r.match(/\(([\d,]+)\)/)?.[1] ?? "0").replace(/,/g, ""))).reduce((a, b) => a + b, 0)
  assert.ok(grouped > 0 && grouped <= records, `${grouped} recorded units in the groups, ${records} records`)
  assert.ok(page.graphql(mark).some((r) => r.op === 'DatasetsUnitsBySubject'), 'the groups come from the datasets units by subject query')
  // selecting a group makes it one chip
  await page.evaluate(`document.querySelector('.type-row .btn-link').click()`)
  await page.sleep(300)
  await page.click('.btn-done')
  await page.sleep(300)
  const chips = await page.evaluate(`[...document.querySelectorAll('.record-filters .selection-chip')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.equal(chips.length, 1, `one chip for the group: ${chips.join('; ')}`)
})
