// Chapter 10, "Your account and personal data" (src/guide/chapters/your-data.md), the last of the joining chain
// (manifest chains.joining, guide/data/joining.mjs): Nina reads her profile, corrects her person record, erases it and
// deletes her account. Plays where the teams chapter left the demonstration database; Nina's account is gone after it.
import { byText, navLink } from '../lib/storyboard.mjs'
import { nina } from '../data/joining.mjs'

const q = JSON.stringify
const section = (heading) => `[...document.querySelectorAll('.profile-section')].find((s) => s.querySelector('h3')?.innerText.trim() === ${q(heading)})`

export const meta = {
  chapter: 'your-data',
  // Nina, who has no account in the build: signed in off camera in run
  account: null
}

export async function check ({ manifest }) {
  if (!manifest.chains?.joining) throw new Error('The build has no joining chain')
}

export async function run ({ page, input, recorder, step, session, manifest, app }) {
  const newcomer = nina(manifest)

  await recorder.hold(async () => {
    await session.login(page, newcomer.username, newcomer.password)
    await page.goto(`${app}/programs`)
    await page.waitFor(`document.querySelector('.program-card')`, 30000)
    await page.sleep(800)
  })
  await input.restoreCursor()

  await step('profile', async () => {
    await input.click(navLink('Profile'))
    await page.waitFor(`document.querySelector('.team-access-list') && ${section('Your person record')}?.querySelector('.person-actions')`, 30000)
    await input.pause(1200)
    await input.hover(`${section('Account')}.querySelector('.details')`, 2200)
    await input.scroll(null, 360)
    await input.hover(`${section('Your person record')}.querySelector('.person-actions')`, 1500)
    await input.hover('document.querySelector(".team-access-list")', 2200)
  })

  await step('account', async () => {
    await input.scroll(null, -800)
    await input.click(byText('button', 'Edit account'))
    await page.waitFor(`document.querySelector('.modal input[name=fullname], input[name=fullname]')`, 15000)
    await input.pause(3200)
    await input.click(`[...document.querySelectorAll('.close-btn')].find((b) => b.offsetParent)`)
    await page.waitFor(`![...document.querySelectorAll('input[name=fullname]')].some((i) => i.offsetParent)`, 15000)
    await input.pause(600)
  })

  await step('person', async () => {
    await input.click(byText('button', 'Edit name and institution'))
    await page.waitFor(`document.querySelector('#person-name')`, 15000)
    await input.pause(800)
    await input.type('document.querySelector("#person-name")', `${newcomer.fullname.split(' ')[0]} M. ${newcomer.fullname.split(' ').slice(1).join(' ')}`)
    await input.pause(600)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`!document.querySelector('#person-name')`, 15000)
    await input.pause(1500)
    const orcid = `${section('Your person record')}.querySelector('.btn-orcid')`
    if (await page.evaluate(`!!(${orcid})`)) await input.hover(orcid, 2200)
    // the choice to be named among the ontology's contributors, left as it is: Nina has added nothing to it
    await input.hover(`${section('Your person record')}.querySelector('.ontology-credit label')`, 2200)
  })

  await step('erase', async () => {
    await input.click(byText('button', 'Unlink from my account'))
    await page.waitFor(byText('button', 'Keep'), 10000)
    await input.hover(`${section('Your person record')}.querySelector('.person-danger')`, 2500)
    await input.click(byText('button', 'Keep'))
    await input.pause(600)
    await input.click(byText('button', 'Erase my person record'))
    await page.waitFor(`document.querySelector('.confirm-erase input')`, 15000)
    await input.pause(2800)
    await input.click('document.querySelector(".confirm-erase input")')
    await input.click(`[...document.querySelectorAll('.modal .btn-danger')].find((b) => b.innerText.trim() === 'Erase')`)
    await page.waitFor(`document.body.innerText.includes('Your account is not linked to a person record')`, 15000)
    await input.pause(2500)
  })

  await step('delete', async () => {
    await input.scroll(null, 600)
    await input.click(byText('button', 'Delete my account'))
    await page.waitFor(`document.querySelector('#delete-password')`, 15000)
    await input.pause(2500)
    await input.type('document.querySelector("#delete-password")', newcomer.password)
    const confirm = `[...document.querySelectorAll('.modal .check-option')].find((l) => l.innerText.includes('permanently deleted'))?.querySelector('input')`
    await input.click(confirm)
    await input.click('document.querySelector(".modal form button[type=submit]")')
    await page.waitFor(`!document.querySelector('.nav-logout')`, 20000)
    await input.pause(3000)
  })
}
