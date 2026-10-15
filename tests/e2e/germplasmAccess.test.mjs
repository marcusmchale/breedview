// The germplasm page under the read policy (breedgraph docs/read-access.md): each viewer's pedigree is drawn with the
// entries they can read, hidden entries between skipped. What the API returns (placeholders, UNKNOWN links past hidden
// entries) is tested in breedgraph; here, that the page draws what the manifest says each viewer can read.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'
import { entities, canRead } from './lib/fixture.mjs'

let browser, page
before(async () => { browser = await launchBrowser({ height: 1800 }); page = browser.page })
after(async () => { await logout(page); await browser?.close() })

const germplasm = Object.keys(entities).filter((name) => entities[name].label === 'Germplasm')
const names = new Set(germplasm.map((name) => entities[name].name))

async function drawn() {
  await page.goto(`${config.appUrl}/germplasm`)
  await page.waitFor(`[...document.querySelectorAll('main svg text')].some((t) => t.textContent.trim() === ${JSON.stringify(entities.crop.name)})`, 30000)
  await page.sleep(1500)
  const labels = await page.evaluate(`[...document.querySelectorAll('main svg text')].map((t) => t.textContent.trim())`)
  return labels.filter((l) => names.has(l)).sort()
}
const readable = (viewer) => germplasm.filter((name) => canRead(viewer, name)).map((name) => entities[name].name).sort()

test('anonymous: the public pedigree is drawn, without write actions or failing requests', async () => {
  const mark = page.mark()
  assert.deepEqual(await drawn(), readable('anonymous'))
  assert.ok(!(await page.evaluate(`[...document.querySelectorAll('main button')].some((b) => /Create|Edit|Delete/.test(b.innerText))`)), 'no write actions')
  assert.deepEqual((await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount:')), [])
})

for (const viewer of ['outsider', 'stranger', 'admin']) {
  test(`${viewer}: the entries they can read are drawn`, async () => {
    await loginAs(page, viewer)
    try {
      assert.deepEqual(await drawn(), readable(viewer))
    } finally {
      await logout(page)
    }
  })
}
