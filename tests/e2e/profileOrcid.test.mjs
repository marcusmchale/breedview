// The profile offers to connect an ORCID iD only where the site can link one (breedgraph peopleOrcidLinking): not on the
// demonstration site, which has no ORCID client, as ORCID would send people back to production. As the outsider, whose
// account the test database links to a Person; what the server answers is stubbed, whatever this backend's ORCID
// settings.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'

const orcidLinking = (available) => `(() => {
  const fetched = window.fetch
  window.fetch = async (input, init) => {
    if (typeof init?.body !== 'string' || !init.body.includes('peopleOrcidLinking')) return fetched(input, init)
    return new Response(JSON.stringify({ data: { peopleOrcidLinking: {
      __typename: 'BooleanPayload', status: 'SUCCESS', result: ${available}, errors: null
    } } }), { headers: { 'Content-Type': 'application/json' } })
  }
})()`

let browser, page
before(async () => {
  browser = await launchBrowser(); page = browser.page
  await loginAs(page, 'outsider')
})
after(async () => { await logout(page); await browser?.close() })

test('the profile offers to connect an ORCID iD only where the site can link one', async () => {
  for (const available of [true, false]) {
    const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: orcidLinking(available) })
    try {
      await page.goto(`${config.appUrl}/profile`)
      await page.waitFor(available ? `document.querySelector('.btn-orcid')` : `document.querySelector('.orcid-not-offered')`, 30000)
      assert.equal(await page.exists('.btn-orcid'), available)
      if (!available) {
        assert.equal((await page.text('.orcid-not-offered')).trim(), "Linking an ORCID iD isn't available on this site.")
      }
    } finally {
      await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    }
  }
})
