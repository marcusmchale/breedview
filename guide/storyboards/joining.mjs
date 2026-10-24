// Chapter 2, "Joining BreedGraph" (src/guide/chapters/joining.md), the first of the joining chain (manifest
// chains.joining, guide/data/joining.mjs): Bridget invites Nina, offering Read and Write on her team and Nina's person
// record; Nina registers from the emailed link, verifies her address and signs in. Plays from a fresh load of the
// demonstration database, in which Nina has no account; the teams chapter goes on from it.
import { byText, navLink } from '../lib/storyboard.mjs'
import { nina } from '../data/joining.mjs'

const q = JSON.stringify
// a FormKit checkbox, by its name: the box drawn beside its hidden input, which a person clicks
const box = (name) => `document.querySelector('input[name=${name}]').closest('.formkit-inner')`

export const meta = {
  chapter: 'joining',
  // the inviter, signed in off camera
  account: 'bridget'
}

export async function check ({ manifest }) {
  const chain = manifest.chains?.joining
  if (!chain || manifest.accounts[chain.invitee.username]) throw new Error('The build has no joining chain, or Nina already')
}

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const chain = manifest.chains.joining
  const newcomer = nina(manifest)
  const team = manifest.teams[chain.offer.team].name
  const person = manifest.entities[chain.offer.person].name
  const startedAt = new Date().toISOString()

  await recorder.hold(async () => {
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('invite', async () => {
    await input.click(navLink('Profile'))
    await page.waitFor(byText('button', 'Invite user'), 30000)
    await input.pause(1200)
    await input.click(byText('button', 'Invite user'))
    await page.waitFor(`document.querySelector('#invite-email')`, 15000)
    await input.pause(800)
    await input.type('document.querySelector("#invite-email")', newcomer.email)
    const offer = `[...document.querySelectorAll('.offer-item')].find((e) => e.querySelector('.offer-team')?.innerText.trim() === ${q(team)})`
    await page.waitFor(offer, 15000)
    for (const level of ['READ', 'WRITE']) await input.click(`(${offer}).querySelector('input[name$="-${level}"]')`)
    // the person record, labelled with its institution
    const option = `[...document.querySelectorAll('#invite-person option')].find((o) => o.text.trim().startsWith(${q(person)}))`
    await page.waitFor(option, 15000)
    await input.choose('document.querySelector("#invite-person")', await page.evaluate(`(${option}).text.trim()`))
    await input.pause(700)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`document.querySelector('.modal .success-message')`, 15000)
    await input.pause(1200)
    const pending = `[...document.querySelectorAll('.invitation-item')].find((e) => e.innerText.includes(${q(newcomer.email)}))`
    await page.waitFor(pending, 15000)
    await input.hover(pending, 2800)
  })

  // Nina's turn, in a browser of her own: Bridget signs out, off camera
  await recorder.hold(async () => {
    await page.click('.modal-close-btn')
    await session.logout(page)
  })

  await step('email', async () => {
    const mail = await session.waitForMail(newcomer.email, 'Invitation to register', { after: startedAt })
    await input.email(mail, 4500)
    const link = mail.links.find((l) => l.includes('/register?token='))
    await recorder.hold(async () => {
      await page.goto(link)
      await page.waitFor(`document.querySelector('input[name=name]')`, 30000)
      await page.sleep(800)
    })
    await input.restoreCursor()
  })

  await step('register', async () => {
    await input.pause(1500)
    await input.type('document.querySelector("input[name=name]")', newcomer.username)
    await input.type('document.querySelector("input[name=fullname]")', newcomer.fullname)
    await input.type('document.querySelector("input[name=password]")', newcomer.password)
    await input.click(box('acceptTeamIds'))
    await input.click(box('linkPerson'))
    await input.pause(500)
    await input.hover('document.querySelector(".gdpr-consent")', 1500)
    await input.click(box('privacyConsent'))
    await input.pause(800)
    await input.click('document.querySelector(".form-container button[type=submit]")')
    await page.waitFor(`document.querySelector('.form-container .success-message, .form-container .error-message')`, 15000)
    const error = await page.evaluate(`document.querySelector('.form-container .error-message')?.innerText ?? null`)
    if (error) throw new Error(`Registration refused: ${error}`)
    await input.pause(2500)
  })

  await step('verify', async () => {
    const mail = await session.waitForMail(newcomer.email, 'email verification', { after: startedAt })
    await input.email(mail, 4000)
    const link = mail.links.find((l) => l.includes('verify'))
    await recorder.hold(async () => {
      await page.goto(link)
      await page.sleep(2500)
    })
    await input.restoreCursor()
    await input.pause(2500)
  })

  await step('profile', async () => {
    await input.click('document.querySelector(".nav-login")')
    await page.waitFor(`document.querySelector('input[name=username]')`, 15000)
    await input.pause(600)
    await input.type('document.querySelector("input[name=username]")', newcomer.username)
    await input.type('document.querySelector("input[name=password]")', newcomer.password)
    await input.click('document.querySelector("button[type=submit]")')
    await page.waitFor(`document.querySelector('.nav-logout')`, 15000)
    await input.pause(1200)
    await input.click(navLink('Profile'))
    await page.waitFor(`document.querySelector('.team-access-list')`, 30000)
    await input.pause(2500)
    await input.scroll(null, 420)
    await input.pause(3500)
  })
}
