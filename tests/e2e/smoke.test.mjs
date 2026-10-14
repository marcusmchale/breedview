// Every routed page renders for a signed-in user without console errors.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, login, logout } from './lib/app.mjs'

let browser, page
before(async () => { browser = await launchBrowser(); page = browser.page; await login(page, config.adminUser, config.adminPassword) })
after(async () => { await logout(page); await browser?.close() })

const pages = [
  ['/home', 'Welcome'], ['/affiliations', 'Create New Organisation'], ['/people', 'People'], ['/transfers', 'Control transfers'],
  ['/ontology', ''], ['/germplasm', ''], ['/regions', ''], ['/arrangements', ''], ['/blocks', 'Select a location'],
  ['/programs', 'Program'], ['/datasets', ''], ['/analysis', ''], ['/profile', 'Your profile']
]

for (const [path, expected] of pages) {
  test(`${path} renders`, async () => {
    const mark = page.mark()
    await page.goto(`${config.appUrl}${path}`)
    await page.sleep(2500)
    assert.ok((await page.url()).endsWith(path), `stays on ${path} (not redirected to login)`)
    if (expected) assert.match(await page.text('main'), new RegExp(expected), `shows "${expected}"`)
    assert.deepEqual(page.consoleErrors(mark), [], 'no console errors')
  })
}
