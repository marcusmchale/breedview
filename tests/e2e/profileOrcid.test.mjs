// The profile offers to connect an ORCID iD only where the site can link one (breedgraph peopleOrcidLinking): not on the
// demonstration site, which has no ORCID client, as ORCID would send people back to production. The page ORCID's sign-in
// returns to completes the link with what ORCID put in its address's fragment. As the outsider, whose account the test
// database links to a Person; what the server answers is stubbed, whatever this backend's ORCID settings.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout } from './lib/app.mjs'

// Answers the named operation with the payload given, keeping the variables it was sent in window.stubbed
const stub = (operation, payload) => `(() => {
  const fetched = window.fetch
  window.fetch = async (input, init) => {
    if (typeof init?.body !== 'string' || !init.body.includes(${JSON.stringify(operation)})) return fetched(input, init)
    window.stubbed = JSON.parse(init.body).variables
    return new Response(JSON.stringify({ data: { ${operation}: ${JSON.stringify(payload)} } }),
      { headers: { 'Content-Type': 'application/json' } })
  }
})()`

const withStub = async (source, run) => {
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', { source })
  try {
    await run()
  } finally {
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  }
}

let browser, page
before(async () => {
  browser = await launchBrowser(); page = browser.page
  await loginAs(page, 'outsider')
})
after(async () => { await logout(page); await browser?.close() })

test('the profile offers to connect an ORCID iD only where the site can link one', async () => {
  for (const available of [true, false]) {
    const linking = stub('peopleOrcidLinking', { __typename: 'BooleanPayload', status: 'SUCCESS', result: available, errors: null })
    await withStub(linking, async () => {
      await page.goto(`${config.appUrl}/profile`)
      await page.waitFor(available ? `document.querySelector('.btn-orcid')` : `document.querySelector('.orcid-not-offered')`, 30000)
      assert.equal(await page.exists('.btn-orcid'), available)
      if (!available) {
        assert.equal((await page.text('.orcid-not-offered')).trim(), "Linking an ORCID iD isn't available on this site.")
      }
    })
  }
})

test('the page ORCID returns to completes the link with the id_token and state in its fragment', async () => {
  const completion = stub('peopleCompleteOrcidLink', { __typename: 'BooleanPayload', status: 'SUCCESS', errors: null })
  await withStub(completion, async () => {
    // As ORCID sends it, with an access token, which is not used
    const fragment = 'access_token=unused&token_type=Bearer&expires_in=3599&id_token=header.claims.signature&state=a-state'
    await page.goto(`${config.appUrl}/orcid#${fragment}`)
    await page.waitFor(`document.querySelector('.success-message')`, 30000)
    assert.deepEqual(await page.evaluate('window.stubbed'), { idToken: 'header.claims.signature', state: 'a-state' })
    assert.equal((await page.text('.success-message')).trim(), 'Your ORCID iD is now linked.')
    // The profile has taken the page with the id_token out of the address
    assert.ok((await page.url()).endsWith('/profile'))
  })
})

test('a sign-in cancelled at ORCID returns to the profile saying so', async () => {
  await page.goto(`${config.appUrl}/orcid#error=access_denied&error_description=User%20denied%20access&state=a-state`)
  await page.waitFor(`document.querySelector('.error-message')`, 30000)
  assert.equal((await page.text('.error-message')).trim(), 'ORCID sign-in was cancelled.')
  assert.ok((await page.url()).endsWith('/profile'))
})
