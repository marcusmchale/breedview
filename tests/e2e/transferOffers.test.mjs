// Transfer offers name what they offer, so an admin sees what control is asked of them: as the admin, whose root team
// offers the test database's program_public to the other team tree (made through the API), then cancels the offer.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config, loginAs, logout, graphql } from './lib/app.mjs'
import { entities as e, teams } from './lib/fixture.mjs'

const q = JSON.stringify
const PENDING = 'query { controlsTransfers(statuses: [PENDING]) { result { id entities { label id } } } }'
const ours = (transfers) => transfers.filter((t) => t.entities.some((entity) => entity.label === 'PROGRAM' && entity.id === String(e.program_public.id)))

let browser, page
before(async () => { browser = await launchBrowser({ height: 1400 }); page = browser.page; await loginAs(page, 'admin') })
after(async () => {
  try {
    // an offer the test left pending, cancelled
    for (const transfer of ours((await graphql(page, PENDING)).result)) {
      await graphql(page, 'mutation ($id: ID!) { controlsCancelTransfer(id: $id) { status } }', { id: transfer.id })
    }
    await logout(page)
  } finally {
    await browser?.close()
  }
})

test('an offer lists the records it offers by name, and is cancelled from the list', async () => {
  const offered = await graphql(page, 'mutation ($offer: ControlTransferOffer!) { controlsOfferTransfer(offer: $offer) { status errors { message } } }', {
    offer: {
      entities: [{ label: 'PROGRAM', id: String(e.program_public.id) }],
      fromTeamIds: [String(teams.root.id)],
      recipientTeamId: String(teams.other.id),
      keepFromTeams: true
    }
  })
  assert.equal(offered.status, 'SUCCESS', q(offered.errors))

  await page.goto(`${config.appUrl}/access?tab=offers`)
  const item = `[...document.querySelectorAll('.transfer-item')].find((i) => i.querySelector('.entities')?.innerText.includes(${q(e.program_public.name)}))`
  await page.waitFor(item, 30000)
  assert.deepEqual(await page.evaluate(`[...(${item}).querySelectorAll('.entities li')].map((li) => li.innerText.trim())`), [`Program: ${e.program_public.name}`])

  await page.evaluate(`[...(${item}).querySelectorAll('.transfer-actions button')].find((b) => b.innerText.includes('Cancel offer')).click()`)
  await page.waitFor(`!(${item})`, 30000)
  assert.deepEqual(ours((await graphql(page, PENDING)).result), [])
})
