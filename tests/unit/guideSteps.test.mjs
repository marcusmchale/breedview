// The steps of a guide chapter (src/guide/steps.mjs): the captions and ids its video is recorded and encoded with
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { parseSteps, withoutStepIds } from '../../src/guide/steps.mjs'

const chapter = `# A chapter

Some text.

## Steps

1. **The Terms of Use come first.** Tick "I have read and agree", then Accept. {#terms}
2. **Programs lists the public programmes.** Open Winter Wheat Breeding Programme,
   then its trial. {#programmes}
3. **Signed in, you see more.** {#log-in}

## Who sees what

1. Not a step. {#not-a-step}
`

test('each numbered item of "## Steps" is a step: its bold lead, details and id, in order', () => {
  assert.deepEqual(parseSteps(chapter), [
    { id: 'terms', lead: 'The Terms of Use come first.', details: 'Tick "I have read and agree", then Accept.' },
    { id: 'programmes', lead: 'Programs lists the public programmes.', details: 'Open Winter Wheat Breeding Programme,\nthen its trial.' },
    { id: 'log-in', lead: 'Signed in, you see more.', details: '' }
  ])
})

test('a chapter without steps has none; a step without an id or a lead, or an id used twice, is refused', () => {
  assert.deepEqual(parseSteps('# No steps\n\nText.'), [])
  assert.throws(() => parseSteps('## Steps\n\n1. **Lead.** No id.'), /has no \{#id\}/)
  assert.throws(() => parseSteps('## Steps\n\n1. No lead. {#a}'), /does not start with a \*\*lead/)
  assert.throws(() => parseSteps('## Steps\n\n1. **One.** {#a}\n2. **Two.** {#a}'), /used twice/)
})

test("the ids are taken out of the chapter's text for rendering", () => {
  assert.ok(!withoutStepIds(chapter).includes('{#'))
  assert.ok(withoutStepIds(chapter).includes('2. **Programs lists the public programmes.** Open Winter Wheat Breeding Programme,'))
})

test("every chapter's steps parse", () => {
  const dir = new URL('../../src/guide/chapters/', import.meta.url)
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
    assert.ok(parseSteps(readFileSync(new URL(file, dir), 'utf8')).length > 0, `${file} has steps`)
  }
})
