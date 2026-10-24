// Chapter 3, "Joining a team, and what access means" (src/guide/chapters/teams.md), the second of the joining chain
// (manifest chains.joining, guide/data/joining.mjs): Nina, who has registered, asks the Institute, the root of her
// team's tree, for Read; Dara approves it as heritable from the email; Nina then sees the lab's study. Plays where the
// joining chapter left the demonstration database.
import { navLink, openStudy } from '../lib/storyboard.mjs'
import { nina } from '../data/joining.mjs'

const q = JSON.stringify

export const meta = {
  chapter: 'teams',
  // Nina, who has no account in the build: signed in off camera in run
  account: null
}

export async function check ({ manifest }) {
  if (!manifest.chains?.joining) throw new Error('The build has no joining chain')
}

// A team in the Teams tree, by its name
const teamNode = (name) => `[...document.querySelectorAll('.team-node')].find((n) => n.querySelector(':scope > .team-header h3')?.innerText.trim() === ${q(name)})`

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const chain = manifest.chains.joining
  const newcomer = nina(manifest)
  const asked = manifest.teams[chain.request.team].name
  const approver = manifest.accounts[chain.request.approver]
  const startedAt = new Date().toISOString()
  const signInAs = (who, label) => recorder.offCamera(async () => {
    await session.logout(page)
    await session.login(page, who.username, who.password)
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
  }, { label })

  await recorder.hold(async () => {
    await session.login(page, newcomer.username, newcomer.password)
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('teams', async () => {
    await input.click(navLink('Access control'))
    await page.waitFor(teamNode(asked), 30000)
    await input.pause(1500)
    await input.hover(`${teamNode(asked)}.querySelector('.team-title-row')`, 1500)
    // opened to the team she belongs to, below it
    const breeding = manifest.teams[chain.offer.team].name
    if (!(await page.evaluate(`!!(${teamNode(breeding)})`))) {
      await input.click(`${teamNode(asked)}.querySelector('.expand-button')`)
      await page.waitFor(teamNode(breeding), 15000)
      await input.pause(800)
    }
    await input.hover(`${teamNode(breeding)}.querySelector('.team-title-row')`, 2500)
  })

  await step('request', async () => {
    await input.click(`[...${teamNode(asked)}.querySelectorAll(':scope > .team-actions button')].find((b) => b.innerText.includes('Request Affiliation'))`)
    await page.waitFor(`document.querySelector('.modal select')`, 15000)
    await input.pause(800)
    await input.choose('document.querySelector(".modal select")', 'Read')
    await input.pause(500)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`document.querySelector('.modal .success-message, .modal .error-message')`, 15000)
    const error = await page.evaluate(`document.querySelector('.modal .error-message')?.innerText ?? null`)
    if (error) throw new Error(`The request was refused: ${error}`)
    await input.pause(2000)
    await recorder.hold(async () => {
      await page.evaluate(`document.querySelector('.modal .modal-close-btn, .modal .btn-secondary')?.click()`)
      await page.sleep(300)
    })
  })

  await signInAs(approver, `Signed in as ${approver.fullname}`)

  await step('approve', async () => {
    const mail = await session.waitForMail(approver.email, 'read access requested', { after: startedAt })
    await input.email(mail, 4000)
    const link = mail.links.find((l) => l.includes('/access?tab=requests'))
    const request = `[...document.querySelectorAll('.request-item')].find((e) => e.innerText.includes(${q(`(${newcomer.username})`)}))`
    await recorder.hold(async () => {
      await page.goto(link)
      await page.waitFor(request, 30000)
      await page.sleep(800)
    })
    await input.restoreCursor()
    await input.hover(request, 1800)
    // approved from the team, where it can be heritable: Read on the teams within the Institute too
    await input.click(`[...document.querySelectorAll('.page-tab')].find((b) => b.innerText.trim() === 'Teams')`)
    await page.waitFor(`[...(${teamNode(asked)})?.querySelectorAll(':scope > .team-actions button') ?? []].some((b) => b.innerText.includes('Manage Affiliations'))`, 30000)
    await input.pause(800)
    await input.click(`[...${teamNode(asked)}.querySelectorAll(':scope > .team-actions button')].find((b) => b.innerText.includes('Manage Affiliations'))`)
    const item = `[...document.querySelectorAll('.affiliation-item')].find((i) => i.innerText.includes(${q(`@${newcomer.username}`)}) && i.querySelector('.btn-heritable'))`
    await page.waitFor(item, 15000)
    await input.pause(1200)
    await input.hover(item, 1500)
    await input.click(`(${item}).querySelector('.btn-heritable')`)
    await page.waitFor(`[...document.querySelectorAll('.affiliation-item')].some((i) => i.innerText.includes(${q(`@${newcomer.username}`)}) && i.innerText.includes('Heritable') && !i.querySelector('.btn-heritable'))`, 30000)
    await input.pause(2200)
    await recorder.hold(async () => {
      await page.evaluate(`[...document.querySelectorAll('.modal button')].find((b) => /Close|×/.test(b.innerText))?.click()`)
      await page.sleep(300)
    })
  })

  await signInAs(newcomer, `Signed in as ${newcomer.fullname} again`)

  let cards
  await step('sees', async () => {
    cards = await openStudy({ page, input, programme: manifest.entities.programme.name, trial: manifest.entities.trial_2025.name, study: manifest.entities.study_lab_2025.name })
    await input.pause(800)
    await input.scroll(null, 380)
    await input.pause(2500)
  })

  await step('releases', async () => {
    for (const card of [cards.studyCard, cards.trialCard, cards.programmeCard]) {
      await input.hover(`(${card}).querySelector('.controller-badge')`, 1600)
    }
    await input.pause(1500)
  })
}
