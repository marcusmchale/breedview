// A user guide chapter (src/guide/chapters/*.md) as its page shows it (GuidePage): its title, and blocks in order, of
// HTML, its video (a line ![alt](<name>.mp4)) and its steps (the "## Steps" section, steps.mjs). Imports nothing from
// Vue or the app, so it can be tested alone.
import { renderMarkdown } from '../composables/system/markdown.js'
import { parseSteps, withoutStepIds } from './steps.mjs'

// where the guide's videos, captions, posters and pictures are served from (public/guide-media)
export const MEDIA = '/guide-media/'
export const GUIDE_OPTIONS = {
  media: (name) => `${MEDIA}${name}`,
  internalLinks: true,
  tables: true,
  code: true,
  callouts: ['WHO', 'SEES', 'DATA', 'NOTE']
}
const VIDEO = /^!\[([^\]]*)\]\(([\w.-]+)\.mp4\)$/
const TITLE = /^#\s+(.*)$/
const SECTION = /^#{1,2}\s/

/** { title, summary, blocks: [{ type: 'html', html } | { type: 'video', name, alt } | { type: 'steps' }], steps } */
export function renderGuide (markdown) {
  const lines = String(markdown ?? '').split(/\r?\n/)
  const steps = parseSteps(markdown).map((step) => ({ ...step, html: renderMarkdown(step.details, GUIDE_OPTIONS) }))
  let title = ''
  const blocks = []
  let pending = []
  const flush = () => {
    if (pending.join('').trim()) blocks.push({ type: 'html', html: renderMarkdown(withoutStepIds(pending.join('\n')), GUIDE_OPTIONS) })
    pending = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const heading = TITLE.exec(line)
    if (heading && !title) {
      title = heading[1].trim()
      continue
    }
    const video = VIDEO.exec(line)
    if (video) {
      flush()
      blocks.push({ type: 'video', name: video[2], alt: video[1] })
      continue
    }
    if (/^##\s+Steps\s*$/.test(line)) {
      flush()
      blocks.push({ type: 'steps' })
      while (i + 1 < lines.length && !SECTION.test(lines[i + 1].trim())) i++
      continue
    }
    pending.push(lines[i])
  }
  flush()
  // the first paragraph, for the index
  const summary = /<p>([\s\S]*?)<\/p>/.exec(blocks.find((block) => block.type === 'html')?.html ?? '')?.[1] ?? ''
  return { title, summary, blocks, steps }
}
