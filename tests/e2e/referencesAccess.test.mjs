// References under the read policy (breedgraph docs/read-access.md): each reference is its own aggregate, so one the
// reader cannot see is a placeholder where something refers to it by id (its id, type and a REDACTED description),
// and searches leave it out. Checked for an anonymous reader, a registered user in no team and an admin of the
// controlling team, with the releases of lib/partialAccess.mjs: reference 4 is public, reference 3 private, and the
// public dataset 1178 has records citing reference 3. Anyone who can read a file reference can download its file.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout, graphql } from './lib/app.mjs'
import { ensureReleases, loginPartial, references } from './lib/partialAccess.mjs'

let browser, page
before(async () => {
  browser = await launchBrowser(); page = browser.page
  await login(page, config.adminUser, config.adminPassword); await ensureReleases(page); await logout(page)
  await page.goto(`${config.appUrl}/login`)
})
after(async () => { await logout(page); await browser?.close() })

const byId = async () => (await graphql(page, `query ($ids: [ID!]!) { references(ids: $ids) { status result {
  __typename id description ... on DataFileReference { filename fileId } } } }`, { ids: [references.hidden, references.public] })).result
const search = async () => (await graphql(page, `query ($description: String!) { referencesSearch(description: $description) {
  status result { id } } }`, { description: references.description })).result.map((r) => Number(r.id)).sort()
const citations = async () => (await graphql(page, `query ($ids: [ID!]) { datasets(ids: $ids) { result {
  records(limit: 1) { references { id description } } } } }`, { ids: [references.citedBy] })).result[0].records[0].references

const downloadState = (fileId) => graphql(page, `query ($fileId: ID!) { referencesFileDownloadState(fileId: $fileId) {
  status errors { message } result { status } } }`, { fileId })
const download = (fileId) => graphql(page, `query ($fileId: ID!) { referencesFileDownload(fileId: $fileId) {
  status errors { message } result { url } } }`, { fileId })
// fetch a download link from the page, as the browser would follow it: the status and the bytes received
const fetchFile = (url) => page.evaluate(`fetch(${JSON.stringify(url)}).then(async (r) => [r.status, (await r.arrayBuffer()).byteLength])`)

async function checkOutsider() {
  const [hidden, shown] = await byId()
  assert.deepEqual(hidden, { __typename: 'DataFileReference', id: String(references.hidden), description: 'REDACTED', filename: null, fileId: null })
  assert.equal(shown.id, String(references.public))
  assert.ok(shown.filename && shown.description !== 'REDACTED', 'the public reference in full')
  assert.deepEqual(await search(), [references.public], 'a search finds only what the reader can see')
  assert.deepEqual(await citations(), [{ id: String(references.hidden), description: 'REDACTED' }], 'a cited private reference is a placeholder')
  // the public reference's file can be downloaded, the private one's cannot, nor its state be seen
  assert.equal((await downloadState(references.publicFile)).result?.status, 'AVAILABLE')
  const link = await download(references.publicFile)
  assert.equal(link.status, 'SUCCESS', JSON.stringify(link.errors))
  const [status, bytes] = await fetchFile(link.result.url)
  assert.equal(status, 200)
  assert.ok(bytes > 0, 'the file arrives')
  for (const query of [downloadState, download]) {
    const refused = await query(references.hiddenFile)
    assert.equal(refused.status, 'ERROR')
    assert.match(refused.errors[0].message, /do not have access/)
  }
}

test('anonymous: placeholders for private references, searches find the public one', checkOutsider)

test('a registered user in no team sees the same', async () => {
  await loginPartial(page)
  await checkOutsider()
  await logout(page)
})

test('an admin of the controlling team sees every reference', async () => {
  await login(page, config.adminUser, config.adminPassword)
  const [hidden] = await byId()
  assert.notEqual(hidden.description, 'REDACTED')
  assert.ok(hidden.filename, 'in full')
  assert.ok((await search()).includes(references.hidden), 'and finds it')
  assert.notEqual((await citations())[0].description, 'REDACTED')
  const link = await download(references.hiddenFile)
  assert.equal(link.status, 'SUCCESS', 'and can download its file')
  assert.equal((await fetchFile(link.result.url))[0], 200)
})
