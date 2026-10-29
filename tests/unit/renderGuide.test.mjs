// A guide chapter split for its page (src/guide/renderGuide.js): title, text, video and steps, in order
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { linksTo, renderGuide } from '../../src/guide/renderGuide.js'

const chapter = `# Looking around

Anyone can look around.

> [!WHO]
> Anyone.

![Looking around](looking-around.mp4)

## Steps

1. **The Terms come first.** Tick, then Accept. {#terms}
2. **Programs lists what is public.** {#programmes}

## Who sees what

Visitors see what is public.
`

test('a chapter is its title, then its blocks in order: text, video, steps, text', () => {
  const page = renderGuide(chapter)
  assert.equal(page.title, 'Looking around')
  assert.equal(page.summary, 'Anyone can look around.')
  assert.deepEqual(page.blocks.map((block) => block.type), ['html', 'video', 'steps', 'html'])
  assert.deepEqual(page.blocks[1], { type: 'video', name: 'looking-around', alt: 'Looking around' })
  assert.ok(page.blocks[0].html.includes('<aside class="callout callout-who">'))
  assert.ok(page.blocks[3].html.startsWith('<h2>Who sees what</h2>'))
  assert.ok(!page.blocks.some((block) => block.html?.includes('{#')), 'no step ids are shown')
  assert.deepEqual(page.steps.map((step) => [step.id, step.lead, step.html]), [
    ['terms', 'The Terms come first.', '<p>Tick, then Accept.</p>'],
    ['programmes', 'Programs lists what is public.', '']
  ])
})

test('chapter 1 renders, with its video and ten steps', () => {
  const page = renderGuide(readFileSync(new URL('../../src/guide/chapters/looking-around.md', import.meta.url), 'utf8'))
  assert.equal(page.title, 'Looking around as a visitor')
  assert.equal(page.blocks.filter((block) => block.type === 'video').length, 1)
  assert.equal(page.steps.length, 10)
  assert.equal(page.steps.find((step) => step.id === 'search')?.lead, "The map's search finds places.")
})

test('a link to a chapter not yet written shows as its text, until it is written', () => {
  const opens = linksTo(['joining', 'teams'])
  assert.ok(opens('/guide/joining#steps'))
  assert.ok(!opens('/guide/planting'))
  assert.ok(!opens('/guide/print/dpo'), 'the printed collections are documents of their own, not in a site')
  assert.ok(opens('/guide'), 'the contents')
  assert.ok(opens('/programs'), 'the app')
  const page = renderGuide('# T\n\nAs [Planting a trial](/guide/planting) shows, after [Joining](/guide/joining).\n', { internalLinks: opens })
  assert.equal(page.blocks[0].html, '<p>As Planting a trial shows, after <a href="/guide/joining">Joining</a>.</p>')
})
