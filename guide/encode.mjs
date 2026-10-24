// Encodes the guide's recordings again from their saved frames (guide/out/<chapter>/), with the captions their chapters
// give now: after rewording a step's lead, no new recording is needed.
//
//   node guide/encode.mjs [--only <chapter>]
import { parseArgs } from 'node:util'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { parseSteps } from '../src/guide/steps.mjs'
import { encode } from './lib/encode.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { values: options } = parseArgs({ options: { only: { type: 'string' } } })
const out = join(root, 'guide/out')
const recorded = existsSync(out)
  ? readdirSync(out).filter((name) => existsSync(join(out, name, 'timeline.json')) && (!options.only || name === options.only))
  : []
if (recorded.length === 0) throw new Error(`No recording${options.only ? ` of ${options.only}` : ''} in guide/out: record first`)

for (const name of recorded) {
  const storyboard = await import(join(root, 'guide/storyboards', `${name}.mjs`))
  const chapter = storyboard.meta.chapter
  const steps = parseSteps(readFileSync(join(root, 'src/guide/chapters', `${chapter}.md`), 'utf8'))
  const video = encode({ dir: join(out, name), steps, out: join(root, 'public/guide-media'), name: chapter })
  console.log(`${name}: ${video.width}x${video.height}, ${video.duration.toFixed(1)} s, ${(video.size / 1e6).toFixed(1)} MB`)
}
