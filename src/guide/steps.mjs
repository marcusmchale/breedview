/*
 * The steps of a guide chapter (src/guide/chapters/*.md): the numbered items of its "## Steps" section, each written
 *
 *     1. **Lead sentence.** Details, in Markdown, over as many indented lines as needed. {#step-id}
 *
 * The bold lead is the caption of the step in the chapter's video, and the id ties the step to the storyboard that
 * records it (guide/storyboards): a recording fails when they differ, so rewording a caption needs only the chapter and
 * a new encoding. Shared by the recorder (Node) and the guide's pages (Vite), so it imports nothing.
 */

const STEPS_HEADING = /^##\s+Steps\s*$/
const HEADING = /^#{1,2}\s/
const ITEM = /^\d+\.\s+(.*)$/
const LEAD = /^\*\*(.+?)\*\*\s*([\s\S]*)$/
const ID = /\s*\{#([a-z0-9][a-z0-9-]*)\}\s*$/

/** [{ id, lead, details }] in the chapter's order; none for a chapter without steps. Throws where one is malformed. */
export function parseSteps (markdown) {
  const lines = String(markdown ?? '').split('\n')
  const start = lines.findIndex((line) => STEPS_HEADING.test(line))
  if (start < 0) return []
  const items = []
  for (const line of lines.slice(start + 1)) {
    if (HEADING.test(line)) break
    const item = ITEM.exec(line)
    if (item) items.push(item[1])
    else if (items.length && line.trim()) items[items.length - 1] += `\n${line.trim()}`
  }
  const seen = new Set()
  return items.map((text, index) => {
    const id = ID.exec(text)?.[1]
    if (!id) throw new Error(`Step ${index + 1} has no {#id}: ${text.slice(0, 80)}`)
    if (seen.has(id)) throw new Error(`The step id ${id} is used twice`)
    seen.add(id)
    const lead = LEAD.exec(text.replace(ID, ''))
    if (!lead) throw new Error(`Step ${id} does not start with a **lead sentence.**`)
    return { id, lead: lead[1].trim(), details: lead[2].trim() }
  })
}

/** The chapter's text with each step's {#id} taken out, for rendering it */
export const withoutStepIds = (markdown) => String(markdown ?? '').replace(/[ \t]*\{#[a-z0-9][a-z0-9-]*\}[ \t]*$/gm, '')
