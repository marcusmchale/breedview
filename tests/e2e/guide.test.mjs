// The user guide (src/guide, src/components/guide) is open to everyone, before the Terms of Use too, as it shows no
// data. Its contents list every chapter written; a chapter shows its text, video and steps, and a step's Play button
// plays the video from that step; a collection's print page puts a poster and a link where each video would be. Like
// the rest of the site, it contacts no third party. The videos are not in the repository (public/guide-media, recorded
// by guide/record.mjs): where a chapter's is missing, the test of its steps is skipped.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { launchBrowser } from './lib/browser.mjs'
import { config, flat } from './lib/app.mjs'

// each chapter's title, the first line of its source
const CHAPTERS = new URL('../../src/guide/chapters/', import.meta.url)
const titles = Object.fromEntries(readdirSync(CHAPTERS).filter((name) => name.endsWith('.md'))
  .map((name) => [name.replace(/\.md$/, ''), readFileSync(new URL(name, CHAPTERS), 'utf8').match(/^# (.*)$/m)[1]]))

let browser, page
before(async () => { browser = await launchBrowser({ acceptTerms: false }); page = browser.page })
after(async () => { await browser?.close() })

test('the guide opens before the Terms of Use, and its contents list every chapter written', async () => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/guide`)
  await page.waitFor(`document.querySelector('.guide-page .chapter-list a')`, 30000)
  assert.equal(await page.evaluate(`document.querySelector('[data-terms]')?.dataset.terms`), 'asked', 'the Terms are still to be accepted')
  assert.equal(await page.exists('.terms-gate'), false, 'the guide is shown in place of the Terms')
  const listed = await page.evaluate(`[...document.querySelectorAll('.chapter-list a:not([href^="/guide/print/"])')]
    .map((a) => [a.getAttribute('href'), a.innerText.trim()])`)
  assert.deepEqual(listed.sort(), Object.entries(titles).map(([slug, title]) => [`/guide/${slug}`, title]).sort())
  assert.deepEqual(page.consoleErrors(mark), [])
})

test('a chapter shows its text and steps, and Play on a step plays the video from that step', async (t) => {
  const mark = page.mark()
  await page.goto(`${config.appUrl}/guide/looking-around`)
  await page.waitFor(`document.querySelector('.guide-steps li')`, 30000)
  assert.equal(flat(await page.text('main h1')), titles['looking-around'])
  assert.ok(await page.exists('main aside.callout-who'), 'who can do this')
  assert.equal(await page.evaluate(`document.querySelectorAll('.guide-steps li').length`), 9)
  assert.ok(!(await page.text('main')).includes('{#'), 'no step ids are shown')
  assert.deepEqual(page.consoleErrors(mark), [])

  await page.waitFor(`document.querySelector('.guide-video video')?.textTracks[0]?.cues?.length ||
    document.querySelector('.guide-video .missing')`, 30000)
  if (await page.exists('.guide-video .missing')) return t.skip('public/guide-media has no looking-around.mp4')
  await page.click('#step-curate .step-play')
  await page.waitFor(`document.querySelector('.guide-steps li.current')?.id === 'step-curate'`, 15000)
  const { time, start } = await page.evaluate(`(() => {
    const video = document.querySelector('.guide-video video')
    return { time: video.currentTime, start: [...video.textTracks[0].cues].find((cue) => cue.id === 'curate').startTime }
  })()`)
  assert.ok(time >= start && time < start + 2, `plays from the step's start, ${start}s: at ${time}s`)
  assert.equal(flat(await page.text('.caption-bar')), flat(await page.text('#step-curate .step-lead strong')), 'the bar shows the step')
})

test('a chapter not written says so, with a link to the contents', async () => {
  await page.goto(`${config.appUrl}/guide/no-such-chapter`)
  await page.waitFor(`document.querySelector('.guide-page p a[href="/guide"]')`, 30000)
  assert.match(flat(await page.text('main')), /The guide has no chapter "no-such-chapter"/)
})

test("a collection's print page has each of its chapters written, with a poster and a link in place of the video", async () => {
  const chapters = () => page.evaluate(`[...document.querySelectorAll('.print-chapter')].map((chapter) => ({
    title: chapter.querySelector('h1').innerText.trim(),
    video: !!chapter.querySelector('video'),
    poster: chapter.querySelector('.print-video img')?.getAttribute('src') ?? null,
    link: chapter.querySelector('.print-video a')?.getAttribute('href') ?? null
  }))`)
  await page.goto(`${config.appUrl}/guide/print/dpo`)
  await page.waitFor(`document.querySelector('.print-chapter')`, 30000)
  assert.equal(await page.exists('nav.navbar'), false, 'no navigation')
  const origin = new URL(config.appUrl).origin
  assert.deepEqual((await chapters()).find((chapter) => chapter.title === titles['looking-around']),
    { title: titles['looking-around'], video: false, poster: '/guide-media/looking-around.jpg', link: `${origin}/guide/looking-around` })

  // printed elsewhere for a site (guide/pdf.mjs --site), the links name it; anything but an address is ignored
  for (const [site, expected] of [['https://demo.example.org', 'https://demo.example.org'], ['javascript:alert(1)', origin]]) {
    await page.goto(`${config.appUrl}/guide/print/dpo?site=${encodeURIComponent(site)}`)
    await page.waitFor(`document.querySelector('.print-chapter')`, 30000)
    assert.equal((await chapters())[0].link, `${expected}/guide/looking-around`, site)
  }
})

test('the guide contacts no third party', async () => {
  const mark = page.mark()
  for (const path of ['/guide', '/guide/looking-around', '/guide/print/dpo']) {
    await page.goto(`${config.appUrl}${path}`)
    await page.sleep(2000)
  }
  const ours = [new URL(config.appUrl).origin, new URL(config.apiUrl).origin]
  assert.deepEqual((await page.origins(mark)).filter((origin) => !ours.includes(origin)), [])
})
