// Chapter 16, "Handing over control" (src/guide/chapters/handing-over.md), independent (manifest
// workflows.bulk_control): Bridget, an admin of the Wheat Breeding Group, offers control of three lines to the
// Cooperative from Bulk control, keeping the group's, so that control is shared; Petra, an admin of the Cooperative,
// accepts it under Transfer offers; the lines' controller then lists both teams. Plays from a fresh load of the
// demonstration database.
import { byText, navLink } from '../lib/storyboard.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'handing-over',
  // the offering side's admin, signed in off camera
  account: 'bridget'
}

const CONTROLLERS = 'query ($ids: [ID!]!) { controlsControllers(entityLabel: GERMPLASM, entityIds: $ids) { result { teams { team { id } } } } }'

export async function check ({ page, session, manifest }) {
  const plan = manifest.workflows?.bulk_control
  if (!plan) throw new Error('The build has no bulk_control workflow')
  const ids = plan.germplasm.map((key) => String(manifest.entities[key].id))
  const { result } = await session.graphql(page, CONTROLLERS, { ids })
  if (result.some((controller) => controller.teams.length !== 1)) throw new Error('The lines are shared already: load the dump again')
}

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const plan = manifest.workflows.bulk_control
  const team = manifest.teams[plan.team].name
  const recipient = manifest.teams[plan.to].name
  const lines = plan.germplasm.map((key) => manifest.entities[key].name)
  const signInAs = (who) => recorder.offCamera(async () => {
    await session.logout(page)
    await session.login(page, who.username, who.password)
    await page.goto(`${app}/access?tab=offers`)
    await page.waitFor(`document.querySelector('.transfer-item')`, 30000)
  }, { label: `Signed in as ${who.fullname}` })
  const row = (line) => `[...document.querySelectorAll('.controlled-table tbody tr')].find((tr) => tr.innerText.includes(${q(line)}))`
  const modal = (selector) => `document.querySelector(${q(`.modal ${selector}`)})`

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('choose', async () => {
    await input.click(navLink('Access control'))
    await page.waitFor(byText('.page-tab', 'Bulk control'), 30000)
    await input.click(byText('.page-tab', 'Bulk control'))
    await page.waitFor(`document.querySelector('select[name=bulkTeam]')`, 30000)
    await input.choose('document.querySelector("select[name=bulkTeam]")', team)
    await page.waitFor(`document.querySelector('.counts-table tr[data-label=GERMPLASM] th button')`, 30000)
    await input.pause(1500)
    await input.click('document.querySelector(".counts-table tr[data-label=GERMPLASM] th button")')
    await page.waitFor(`${row(lines[0])}?.querySelector('input')`, 30000)
    await input.pause(1000)
    for (const line of lines) await input.click(`(${row(line)}).querySelector('input')`)
    await page.waitFor(`document.querySelector('.selection-description')?.innerText.includes('3')`, 15000)
    await input.pause(1000)
  })

  await step('offer', async () => {
    await input.click(byText('.bulk-actions button', 'Offer transfer…'))
    await page.waitFor(modal('#recipient-team'), 15000)
    await input.pause(1000)
    await input.hover(modal('.intro'), 2000)
    await input.choose(modal('#recipient-team'), recipient)
    await input.click(`[...document.querySelectorAll('.modal label.check-option')].find((l) => l.innerText.includes('Share control'))?.querySelector('input')`)
    await input.pause(1000)
    await input.click(modal('button[type=submit]'))
    await page.waitFor(`!document.querySelector('#recipient-team') && document.querySelector('.action-message')?.innerText.startsWith('Offered')`, 30000)
    await input.pause(800)
    await input.hover('document.querySelector(".action-message")', 2500)
  })

  await signInAs(manifest.accounts[plan.accepter])

  await step('accept', async () => {
    await input.restoreCursor()
    const offer = `[...document.querySelectorAll('.transfer-item')].find((i) => i.querySelector('.entities')?.innerText.includes(${q(lines[0])}))`
    await page.waitFor(offer, 15000)
    await input.pause(1000)
    await input.hover(`(${offer}).querySelector('.entities')`, 2000)
    await input.hover(`(${offer}).querySelector('.details')`, 2000)
    await input.click(byText('.transfer-actions button', 'Accept', `(${offer})`))
    await page.waitFor(modal('.check-option input'), 15000)
    await input.pause(1000)
    await input.hover(modal('.intro'), 2000)
    await input.choose(modal('select'), 'Registered')
    await input.pause(800)
    await input.click(modal('button[type=submit]'))
    await page.waitFor(`!document.querySelector('.modal') && !(${offer})`, 30000)
    await input.pause(1500)
  })

  await step('shared', async () => {
    // a line's controller, from its card on the germplasm page
    await input.click(navLink('Germplasm'))
    await page.waitFor(`document.querySelector('.search-box .search-input')`, 30000)
    await input.pause(1500)
    await input.type('document.querySelector(".search-box .search-input")', lines[0])
    await page.waitFor(byText('.search-result-item .result-name', lines[0]), 15000)
    await input.click(byText('.search-result-item .result-name', lines[0]))
    const node = `[...document.querySelectorAll('.germplasm-network-graph circle')].find((c) => c.__data__?.name === ${q(lines[0])})`
    await page.waitFor(node, 15000)
    await input.pause(1500)
    await input.click(node)
    const badge = 'document.querySelector(".details-card-container .controller-badge")'
    await page.waitFor(badge, 15000)
    await input.scroll(null, 500, { at: { x: 1262, y: 560 } })
    await input.click(badge)
    await page.waitFor(`document.querySelector('.controller-modal')?.innerText.includes(${q(recipient)})`, 15000)
    await input.pause(1000)
    await input.hover('document.querySelector(".controller-modal")', 3500)
    recorder.poster()
  })
}
