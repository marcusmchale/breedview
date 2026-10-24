// Chapter 9, "People and credit" (src/guide/chapters/people.md), from a fresh load of the demonstration database
// (manifest workflows.people): Bridget adds Hannah Harvester's record and credits her on the programme, and approves
// Petra's request to link her account; Petra sees people by name, and a private record as an id, and writes to the
// programme's contact; a visitor sees no people.
import { byText, loadStudyData, navLink, openStudy, startsWith } from '../lib/storyboard.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'people',
  // the programme's lead, signed in off camera
  account: 'bridget'
}

export async function check ({ manifest }) {
  if (!manifest.workflows?.people) throw new Error('The build has no people workflow')
}

const SUBJECT = 'Seed of the 2025 lines'
const MESSAGE = 'Dear Bridget, the Cooperative would like to multiply seed of your best 2025 lines. Could we talk ' +
  'about it next week? Best wishes, Petra'

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const people = manifest.workflows.people
  const hannah = people.new_person
  const programme = manifest.entities.programme.name
  const programmeCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(programme)})`
  const signInAs = (who, label) => recorder.offCamera(async () => {
    await session.logout(page)
    if (who) await session.login(page, who.username, who.password)
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
  }, { label })

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('add', async () => {
    await input.click(navLink('People'))
    await page.waitFor(byText('button', '+ Add Person'), 30000)
    await input.pause(1500)
    await input.click(byText('button', '+ Add Person'))
    await page.waitFor(`document.querySelector('#person-name')`, 15000)
    await input.pause(800)
    await input.type('document.querySelector("#person-name")', hannah.name)
    await input.type('document.querySelector("#person-institution")', hannah.institution)
    const team = manifest.teams[hannah.team].name
    await input.click(`[...document.querySelectorAll('.team-option')].find((o) => o.innerText.trim() === ${q(team)})?.querySelector('input')`)
    await input.hover('document.querySelector(".consent-attestation")', 1800)
    await input.click('document.querySelector(".consent-attestation input")')
    await input.choose('document.querySelector(".modal .control-selector .selector-item:nth-child(2) select")', 'Registered')
    await input.pause(600)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`!document.querySelector('#person-name') || document.querySelector('.modal .error-message')`, 15000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The person was not added: ${error}`)
    await input.pause(2000)
  })

  await step('credit', async () => {
    await input.click(navLink('Programs'))
    await page.waitFor(`${programmeCard}?.querySelector('.program-actions')`, 30000)
    await input.pause(1000)
    await input.click(`[...(${programmeCard}).querySelectorAll('.program-actions button')].find((b) => b.innerText.trim() === 'Edit')`)
    await page.waitFor(`document.querySelector('.modal .contributions-field')`, 15000)
    await input.pause(800)
    await input.click(`document.querySelector('.modal .contributions-field .field-header button')`)
    await page.waitFor(`document.querySelector('.modal .person-filter')`, 15000)
    await input.type('document.querySelector(".modal .person-filter")', hannah.name.split(' ')[0])
    const option = `[...document.querySelectorAll('.modal .person-option')].find((o) => o.innerText.includes(${q(hannah.name)}))`
    await page.waitFor(option, 15000)
    await input.click(`(${option}).querySelector('input')`)
    await input.click(`document.querySelector('.modal .contributions-field .field-header button')`)
    const contribution = `[...document.querySelectorAll('.modal .contribution')].find((c) => c.innerText.includes(${q(hannah.name)}))`
    await page.waitFor(contribution, 10000)
    await input.click(`(${contribution}).querySelector('.role-menu summary')`)
    await input.click(`[...(${contribution}).querySelectorAll('.role-options label')].find((l) => l.innerText.trim() === ${q(hannah.role)})?.querySelector('input')`)
    await input.click(`(${contribution}).querySelector('.role-menu summary')`)
    await input.pause(800)
    await input.click('document.querySelector(".modal button[type=submit]")')
    await page.waitFor(`!document.querySelector('.modal .contributions-field') || document.querySelector('.modal .error-message')`, 30000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The programme was not saved: ${error}`)
    await input.pause(1200)
    await input.hover(`(${programmeCard}).querySelector('.program-card-header')`, 2500)
  })

  await step('link', async () => {
    await input.click(navLink('People'))
    const request = `[...document.querySelectorAll('.claim-requests .request-item')].find((r) => r.innerText.includes('(${people.claim.claimant})'))`
    await page.waitFor(request, 30000)
    await input.pause(1200)
    await input.hover(request, 2000)
    await input.click(`[...(${request}).querySelectorAll('button')].find((b) => b.innerText.trim() === 'Approve')`)
    await page.waitFor(`[...(${request}).querySelectorAll('button')].some((b) => b.innerText.includes('Yes, approve'))`, 10000)
    await input.pause(1800)
    await input.click(`[...(${request}).querySelectorAll('button')].find((b) => b.innerText.includes('Yes, approve'))`)
    await page.waitFor(`!(${request})`, 30000)
    await input.pause(1500)
  })

  const petra = manifest.accounts[people.claim.claimant]
  await signInAs(petra, `Signed in as ${petra.fullname}`)

  await step('partner', async () => {
    await page.waitFor(programmeCard, 30000)
    await input.pause(800)
    await input.hover(`(${programmeCard}).querySelector('.program-card-header')`, 2500)
    const cards = await openStudy({ page, input, programme, trial: manifest.entities.trial_2024.name, study: manifest.entities.study_2024.name })
    await input.click(startsWith('.section-toggle', '▶ Datasets', cards.studyCard))
    await page.waitFor(`${cards.studyCard}?.querySelector('.view-datasets')`, 30000)
    await input.click(`${cards.studyCard}.querySelector('.view-datasets')`)
    await loadStudyData({ page, input, hold: (accept) => recorder.offCamera(accept, { label: "The study's licence accepted" }) })
    await input.pause(1200)
    await input.click('document.querySelector(".contributors .toggle")')
    await page.waitFor(`document.querySelector('.contributors-list .dataset-contributors')`, 15000)
    await input.hover('document.querySelector(".contributors-list")', 3500)
    await input.click(`${byText('button', 'Close')} ?? document.querySelector('.modal-close, .close-btn')`)
    await page.waitFor(`!document.querySelector('.curation-table')`, 15000)
  })

  await step('message', async () => {
    await input.scroll(null, -2000)
    const contact = `[...(${programmeCard}).querySelectorAll('button')].find((b) => b.innerText.trim() === 'Contact')`
    await page.waitFor(contact, 15000)
    const sentAt = new Date().toISOString()
    await input.click(contact)
    await page.waitFor(`document.querySelector('#contact-subject')`, 15000)
    await input.pause(1500)
    await input.type('document.querySelector("#contact-subject")', SUBJECT)
    await input.type('document.querySelector("#contact-message")', MESSAGE)
    await input.hover('document.querySelector(".modal .warning-message")', 1800)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`document.querySelector('.modal .success-message') || document.querySelector('.modal .error-message')`, 15000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The message was not sent: ${error}`)
    await input.pause(1500)
    await input.click(`[...document.querySelectorAll('.modal button')].find((b) => b.innerText.trim() === 'Close')`)
    // as it reaches Bridget
    const bridget = manifest.accounts.bridget
    const mail = await session.waitForMail(bridget.email, SUBJECT, { after: sentAt })
    await input.email(mail, 5000)
  })

  await signInAs(null, 'Signed out, as a visitor')

  await step('visitor', async () => {
    await page.waitFor(programmeCard, 30000)
    await input.pause(800)
    await input.hover(`(${programmeCard}).querySelector('.program-card-header')`, 3500)
  })
}
