// Records the guide's videos (guide/README.md): each storyboard (guide/storyboards/<chapter>.mjs) is played in a fresh
// headless Chrome against a running demonstration stack, its frames captured at 1920x1200 (a 1280x800 page at a scale of
// 1.5) and encoded with captions from its chapter's steps (src/guide/chapters/<chapter>.md).
//
//   node guide/record.mjs [--only <chapter>] [--fast] [--app http://localhost:8081] [--api http://localhost:8001]
//                         [--manifest <demo manifest>]
//
// --fast plays the storyboards without recording, as a check that they still run (npm run guide:check). A run fails on
// a step that is not its chapter's next, a console error, a GraphQL error, an alert, or an unanswered confirm. It
// refuses the development API (port 8000) and a manifest that is not the demonstration database's.
import { parseArgs } from 'node:util'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { launchBrowser } from '../tests/e2e/lib/browser.mjs'
import { createSession } from '../tests/e2e/lib/session.mjs'
import { parseSteps } from '../src/guide/steps.mjs'
import { createInput } from './lib/input.mjs'
import { createRecorder } from './lib/recorder.mjs'
import { encode } from './lib/encode.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { values: options } = parseArgs({
  options: {
    only: { type: 'string' },
    fast: { type: 'boolean', default: false },
    app: { type: 'string', default: process.env.GUIDE_APP_URL || 'http://localhost:8081' },
    api: { type: 'string', default: process.env.GUIDE_API_URL || 'http://localhost:8001' },
    mailhog: { type: 'string', default: process.env.MAILHOG_URL || 'http://localhost:8025' },
    manifest: {
      type: 'string',
      default: process.env.GUIDE_MANIFEST || join(root, '../breedgraph/instance/neo4j_archive/demo_databases/demo_database.manifest.json')
    }
  }
})

if (new URL(options.api).port === '8000') throw new Error('The API on port 8000 is the development one: record against a demonstration stack')
const manifest = JSON.parse(readFileSync(options.manifest, 'utf8'))
if (manifest.kind !== 'demo') throw new Error(`${options.manifest} is not the demonstration database's manifest`)

const storyboards = readdirSync(join(root, 'guide/storyboards')).filter((file) => file.endsWith('.mjs')).sort()
  .map((file) => file.replace(/\.mjs$/, ''))
  .filter((name) => !options.only || name === options.only)
if (storyboards.length === 0) throw new Error(`No storyboard ${options.only ?? ''} in guide/storyboards`)

const results = []
for (const name of storyboards) {
  const storyboard = await import(join(root, 'guide/storyboards', `${name}.mjs`))
  const chapter = readFileSync(join(root, 'src/guide/chapters', `${storyboard.meta.chapter}.md`), 'utf8')
  const steps = parseSteps(chapter)
  console.log(`${name}: ${steps.length} steps${options.fast ? ', checking' : ', recording'}`)
  results.push(await play(name, storyboard, steps))
}
console.log(JSON.stringify(results, null, 1))

async function play (name, storyboard, steps) {
  // a window a little taller than the page, whose size is then fixed at 1280x800 at 1.5: frames of 1920x1200
  const browser = await launchBrowser({
    width: 1280, height: 888, args: ['--force-device-scale-factor=1.5', '--hide-scrollbars'],
    acceptTerms: storyboard.meta.acceptTerms ?? true, loadsPerTab: Infinity
  })
  const { page } = browser
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1.5, mobile: false })
    await page.send('Page.addScriptToEvaluateOnNewDocument', {
      source: readFileSync(join(root, 'guide/lib/overlay.js'), 'utf8')
    })
    const session = createSession({ appUrl: options.app, apiUrl: options.api, mailhogUrl: options.mailhog })
    const input = createInput(page, { fast: options.fast, seed: name.length })
    const recorder = createRecorder(page, { dir: join(root, 'guide/out', name) })

    // off camera: the account the storyboard starts as, signed in
    const account = storyboard.meta.account ? manifest.accounts[storyboard.meta.account] : null
    if (account) await session.login(page, account.username, account.password)
    await storyboard.check?.({ page, session, manifest, app: options.app })

    let next = 0
    const step = async (id, fn) => {
      const expected = steps[next]
      if (!expected || expected.id !== id) {
        throw new Error(`${name} plays step ${id}, where its chapter's next is ${expected?.id ?? 'none'}`)
      }
      next++
      recorder.step(id)
      const mark = page.mark()
      await fn()
      // a visitor's sign-in check is refused, as it should be
      const refused = (await page.graphqlErrors(mark)).filter((f) => !f.startsWith('accountsAccount: Please provide a valid token'))
      const errors = [...page.consoleErrors(mark), ...refused]
      if (errors.length) throw new Error(`Step ${id}: ${errors.join(' | ')}`)
      const unanswered = await page.evaluate('window.__recorderConfirm?.asked.length ?? 0')
      if (unanswered > confirmsAnswered) throw new Error(`Step ${id} left a confirm unanswered`)
    }
    let confirmsAnswered = 0
    const confirm = async (target, answer) => { await input.confirm(target, answer); confirmsAnswered++ }

    if (!options.fast) await recorder.start()
    await storyboard.run({ page, input: { ...input, confirm }, recorder, step, session, manifest, app: options.app })
    if (next !== steps.length) throw new Error(`${name} stopped before step ${steps[next].id}`)
    if (options.fast) return { name, checked: true }
    const recorded = await recorder.stop()
    const video = encode({ dir: join(root, 'guide/out', name), steps, out: join(root, 'public/guide-media'), name: storyboard.meta.chapter })
    return { name, ...recorded, video }
  } catch (error) {
    await page.screenshot(join(root, 'guide/out', `${name}-failure.png`)).catch(() => {})
    throw error
  } finally {
    await browser.close()
  }
}
