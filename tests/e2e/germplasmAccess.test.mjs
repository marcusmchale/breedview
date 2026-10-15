// Germplasm under the read policy (breedgraph docs/read-access.md): a crop and the entries connected to it are read
// as one pedigree. Entries the reader can see are linked to the nearest ones they can see, hidden entries between
// skipped (an UNKNOWN relationship then); a hidden crop is a placeholder holding the readable entries below it; other
// hidden entries are placeholders only when asked for by id. With the releases of lib/partialAccess.mjs: the crop
// "Private Crop" is private with the public Variety C A1 and its hybrid below it, the hybrid's other parent is
// private, and Variety B is private between the public Taxon B and Variety E.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql } from './lib/app.mjs'
import { ensureReleases, loginPartial, germplasm as g } from './lib/partialAccess.mjs'

let browser, page
before(async () => {
  browser = await launchBrowser({ height: 1800 }); page = browser.page
  await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
  await page.goto(`${config.appUrl}/login`)
})
after(async () => { await logout(page); await browser?.close() })

const relationship = '{ source { id name } sink { id name } sourceType }'
const crops = async () => (await graphql(page, `query { germplasmCrops { result { id name sinks ${relationship} } } }`)).result
const entries = async (ids) => Object.fromEntries((await graphql(page, `query ($ids: [ID!]) { germplasmEntries(ids: $ids) {
  result { id name sources ${relationship} sinks ${relationship} } } }`, { ids })).result.map((e) => [Number(e.id), e]))
const ends = (relationships, end) => relationships.map((r) => [Number(r[end].id), r.sourceType]).sort((a, b) => a[0] - b[0])

async function checkOutsider() {
  const listed = await crops()
  assert.deepEqual(listed.map((c) => [Number(c.id), c.name]), [[g.publicCrop, 'Taxon A'], [g.hiddenCrop, 'REDACTED']])
  assert.deepEqual(ends(listed[1].sinks, 'sink').map(([id]) => id), g.publicUnderCrop, 'the hidden crop holds the public entries below it')

  const e = await entries([g.hiddenMiddle, g.above, g.below, g.hybrid])
  assert.deepEqual([e[g.hiddenMiddle].name, e[g.hiddenMiddle].sources, e[g.hiddenMiddle].sinks], ['REDACTED', [], []])
  assert.deepEqual(ends(e[g.above].sinks, 'sink').find(([id]) => id === g.below), [g.below, 'UNKNOWN'], 'linked past the hidden entry')
  assert.ok(!ends(e[g.above].sinks, 'sink').some(([id]) => id === g.hiddenMiddle), 'the hidden entry is skipped')
  assert.deepEqual(ends(e[g.below].sources, 'source').find(([id]) => id === g.above), [g.above, 'UNKNOWN'])
  assert.deepEqual(ends(e[g.hybrid].sources, 'source'), [[g.hiddenCrop, 'UNKNOWN'], [g.publicParent, 'PATERNAL']],
    'the hybrid keeps its public parent, and reaches the hidden crop past its hidden parent')
}

test('anonymous: the public pedigree, hidden entries skipped and a hidden crop as a placeholder', async () => {
  const mark = page.mark()
  await checkOutsider()
  await page.goto(`${config.appUrl}/germplasm`)
  await page.waitFor(`document.querySelector('main')?.innerText.includes('Variety C A1')`, 30000)
  const labels = await page.evaluate(`[...document.querySelectorAll('main svg text')].map((t) => t.textContent.trim())`)
  assert.ok(labels.includes('Variety C A1'), 'the public entry below the hidden crop is drawn')
  assert.ok(!labels.includes('Variety B'), 'the hidden entry is not drawn')
  assert.ok(!(await page.evaluate(`[...document.querySelectorAll('main button')].some((b) => /Create|Edit|Delete/.test(b.innerText))`)), 'no write actions')
  assert.deepEqual((await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:')), [])
})

test('a registered user in no team sees the same', async () => {
  await loginPartial(page)
  await checkOutsider()
  await logout(page)
})

test('an admin of the controlling teams sees the whole pedigree', async () => {
  await login(page, config.adminUser, config.adminPassword)
  const listed = await crops()
  assert.ok(listed.every((c) => c.name !== 'REDACTED'), 'every crop in full')
  const e = await entries([g.hiddenMiddle, g.hybrid])
  assert.equal(e[g.hiddenMiddle].name, 'Variety B')
  assert.deepEqual(ends(e[g.hybrid].sources, 'source'), [[g.publicParent, 'PATERNAL'], [g.hiddenParent, 'MATERNAL']])
})
