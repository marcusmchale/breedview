// The tests' browser driver (lib/browser.mjs), without the app: a script run in every new document, as a test's stub of
// the API, stays in the fresh tabs goto() moves to, until it is removed
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { launchBrowser } from './lib/browser.mjs'

test('a script added to every new document runs in the fresh tabs too, until removed', async () => {
  const browser = await launchBrowser({ loadsPerTab: 1, acceptTerms: false })
  try {
    const { page } = browser
    const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.stubbed = true' })
    for (const n of [1, 2, 3]) {
      await page.goto(`data:text/html,<p>${n}</p>`)
      assert.equal(await page.evaluate('window.stubbed === true'), true, `page ${n}, in a tab of its own`)
    }
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    await page.goto('data:text/html,<p>4</p>')
    assert.equal(await page.evaluate('window.stubbed === true'), false)
  } finally {
    await browser.close()
  }
})
