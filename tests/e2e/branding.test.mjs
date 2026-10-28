// A deployment's branding (README.md, Branding; src/branding): without a branding.json, as here and on the
// demonstration site, the app keeps its own look, its footer crediting BreedView and BreedGraph; with one, given to the
// page in place of the server's (a script answering its fetch, so nothing is written to the app's files), the header
// takes its colours and logo and the footer its links and text. On the guide's contents, which open to anyone before
// the Terms of Use.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './lib/browser.mjs'
import { config } from './lib/app.mjs'

const q = JSON.stringify
const BRAND = {
  colors: { header: '#7a1f3d', primary: '#00548c' },
  logos: [{ src: 'logo.svg', alt: 'University of Example', href: 'https://www.example.edu' }],
  footer: { text: 'BreedGraph is run by the University of Example.', links: [{ label: 'University of Example', href: 'https://www.example.edu' }] }
}
// answers the app's fetch of branding.json with BRAND, before the app's own scripts run
const ANSWER = `(() => {
  const fetched = window.fetch
  window.fetch = (input, init) => String(input).endsWith('/branding/branding.json')
    ? Promise.resolve(new Response(${q(JSON.stringify(BRAND))}, { headers: { 'content-type': 'application/json' } }))
    : fetched(input, init)
})()`

const browsers = []
after(async () => { for (const browser of browsers) await browser.close() })

async function open (brand) {
  const browser = await launchBrowser({ acceptTerms: false })
  browsers.push(browser)
  const { page } = browser
  if (brand) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: ANSWER })
  await page.goto(`${config.appUrl}/guide`)
  await page.waitFor(`document.querySelector('.chapter-list a') && document.querySelector('.app-footer')`, 30000)
  return page
}
const shell = (page) => page.evaluate(`({
  header: getComputedStyle(document.querySelector('.navbar')).backgroundColor,
  logos: [...document.querySelectorAll('.nav-brand .brand-logo img')].map((img) => [img.getAttribute('src'), img.alt, img.closest('a')?.href ?? null]),
  links: [...document.querySelectorAll('.app-footer .footer-links a')].map((a) => a.innerText.trim()),
  text: document.querySelector('.app-footer .footer-text')?.innerText.trim() ?? null,
  projects: [...document.querySelectorAll('.app-footer .footer-projects a')].map((a) => [a.innerText.trim(), a.href]),
  link: getComputedStyle(document.querySelector('.chapter-list a')).color
})`)
const PROJECTS = [['BreedView', 'https://github.com/marcusmchale/breedview'], ['BreedGraph', 'https://github.com/marcusmchale/breedgraph']]

test('without a branding the app keeps its own look, and its footer credits BreedView and BreedGraph', async () => {
  const page = await open(false)
  const mark = page.mark()
  const seen = await shell(page)
  assert.deepEqual({ ...seen, link: undefined }, {
    header: 'rgb(76, 175, 80)', logos: [], links: ['User guide', 'Terms of Use', 'Privacy notice', 'Open-source licences'], text: null, projects: PROJECTS, link: undefined
  })
  assert.deepEqual(page.consoleErrors(mark), [])
})

test("with a branding the header takes its colour and logo, links its colour, and the footer its links and text", async () => {
  const page = await open(true)
  assert.deepEqual(await shell(page), {
    header: 'rgb(122, 31, 61)',
    logos: [[`${new URL(config.appUrl).pathname.replace(/\/$/, '')}/branding/logo.svg`, 'University of Example', 'https://www.example.edu/']],
    links: ['User guide', 'Terms of Use', 'Privacy notice', 'Open-source licences', 'University of Example'],
    text: 'BreedGraph is run by the University of Example.',
    projects: PROJECTS,
    link: 'rgb(0, 84, 140)'
  })
})
