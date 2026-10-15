// The hierarchical multi-select can select everything of a type below the current level, and navigating keeps working.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout } from './lib/app.mjs'

let browser, page
before(async () => { browser = await launchBrowser(); page = browser.page; await login(page, config.adminUser, config.adminPassword) })
after(async () => { await logout(page); await browser?.close() })

// components/customInputs/SelectionChips.vue: more single chips than this show as their count
const MAX_SELECTION_CHIPS = 20
const typeRows = () => page.evaluate(`[...document.querySelectorAll('.type-row')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
const summary = () => page.evaluate(`document.querySelector('.selection-summary')?.innerText.replace(/\\s+/g, ' ').trim()`)
const typePanelReady = `document.querySelector('.type-row') || document.querySelector('.type-panel-error') || document.querySelector('.type-panel .empty-state')`

test('the studies picker of the analysis editor selects every study by type', async () => {
  await page.goto(`${config.appUrl}/analysis`)
  await page.waitFor(`document.querySelector('.config-editor') || [...document.querySelectorAll('button')].some((e) => e.innerText.includes('New'))`, 30000)
  if (!(await page.exists('.config-editor'))) {
    await page.evaluate(`[...document.querySelectorAll('button')].find((e) => e.innerText.includes('New')).click()`)
    await page.waitFor(`document.querySelector('.config-editor')`)
  }
  await page.sleep(500)
  const mark = page.mark()
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.waitFor(`document.querySelector('.options-list .option-label')`)
  // by type over everything: only studies are selectable, so that is the only group
  await page.click('.select-by-type-button')
  await page.waitFor(typePanelReady, 60000)
  const rows = await typeRows()
  assert.equal(rows.length, 1, `one type group: ${rows.join('; ')}`)
  assert.match(rows[0], /^Study \(\d+\) 0 selected/, 'the studies are grouped with their count')
  const count = Number(rows[0].match(/\((\d+)\)/)[1])
  assert.ok(count > 0, 'there are studies to select')
  await page.evaluate(`document.querySelector('.type-row .btn-link').click()`)
  await page.sleep(300)
  assert.match(await summary(), new RegExp(`^${count} selected`), 'every study is selected')
  assert.match((await typeRows())[0], new RegExp(`${count} selected`), 'the group shows them all selected')
  // navigating to another level closes the panel, and the levels still list their nodes
  await page.evaluate(`[...document.querySelectorAll('.options-list .expand-button')][0].click()`)
  await page.sleep(300)
  assert.equal(await page.exists('.type-panel'), false, 'the type panel closes on navigation')
  assert.ok(await page.exists('.breadcrumb'), 'a program is opened')
  await page.evaluate(`[...document.querySelectorAll('.breadcrumb button.breadcrumb-item')].at(0).click()`)
  await page.sleep(500)
  assert.ok(await page.exists('.options-list .option-label'), 'the root level lists the programs again')
  await page.click('.btn-done')
  await page.sleep(500)
  // the selection by type shows as one chip with its count
  const chips = () => page.evaluate(`[...document.querySelectorAll('#analysis-data .tree-multi-picker .selection-chip')].map((e) => e.innerText.replace(/\\s+/g, ' ').trim())`)
  assert.deepEqual(await chips(), [`Study · ${count} ×`], 'one group chip for the studies selected by type')
  // unticking one study dissolves the group into named chips, or their count when there are many
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.waitFor(`document.querySelector('.options-list .option-label')`)
  for (let level = 0; level < 2; level++) {
    await page.evaluate(`[...document.querySelectorAll('.options-list .expand-button')][0].click()`)
    await page.sleep(300)
    await page.waitFor(`!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`, 30000)
  }
  await page.waitFor(`document.querySelector('.options-list .option-checkbox:checked')`, 30000)
  await page.evaluate(`document.querySelector('.options-list .option-checkbox:checked').click()`)
  await page.sleep(300)
  await page.click('.btn-done')
  await page.sleep(500)
  const single = await chips()
  if (count - 1 > MAX_SELECTION_CHIPS) {
    assert.deepEqual(single, [`${count - 1} selected ×`], 'too many for a chip each: their count')
  } else {
    assert.equal(single.length, count - 1, `a chip per remaining study: ${single.join('; ')}`)
    assert.ok(single.every((c) => !/^Study \d+/.test(c) && !/Study ·/.test(c)), `every chip is a named study: ${single.join('; ')}`)
  }
  // a trial cannot be selected itself, so its tick selects the studies below it, as one group
  await page.evaluate(`document.querySelector('#analysis-data .tree-multi-picker .select-trigger').click()`)
  await page.waitFor(`document.querySelector('.options-list .option-label')`)
  await page.evaluate(`document.querySelector('.selection-summary .clear-all-button').click()`)
  await page.sleep(300)
  await page.evaluate(`[...document.querySelectorAll('.options-list .expand-button')][0].click()`)
  await page.sleep(300)
  await page.waitFor(`!document.querySelector('.options-list .loading-state') && document.querySelector('.options-list .option-label')`, 30000)
  await page.waitFor(`document.querySelector('.options-list .selects-below .option-checkbox:not(:disabled)')`, 30000)
  const trial = await page.evaluate(`document.querySelector('.options-list .selects-below .option-label').innerText.trim()`)
  const studiesBelow = Number((await page.evaluate(`document.querySelector('.options-list .selects-below .option-checkbox').title`)).match(/(\d+) Study/)?.[1])
  assert.ok(studiesBelow > 0, `the trial's tick says how many studies lie below it`)
  await page.evaluate(`document.querySelector('.options-list .selects-below .option-checkbox').click()`)
  await page.sleep(500)
  assert.match(await summary(), new RegExp(`^${studiesBelow} selected`), 'ticking the trial selects its studies')
  assert.ok(await page.evaluate(`document.querySelector('.options-list .selects-below .option-checkbox').checked`), 'the trial shows as selected')
  await page.click('.btn-done')
  await page.sleep(500)
  assert.deepEqual(await chips(), [`Study in ${trial} · ${studiesBelow} ×`], 'one group chip for the studies of the trial')
  assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
})
