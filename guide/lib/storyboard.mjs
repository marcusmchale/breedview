// What the storyboards (guide/storyboards) share: elements found as a person would, by their text, and the ways into
// the app's pages that more than one chapter takes. Expressions are strings, run in the page by the input's targets.
const q = JSON.stringify

// an element by its text, read as shown with its spaces and line breaks taken as one space
const shown = 'e.innerText.replace(/\\s+/g, " ").trim()'
export const byText = (selector, text, within = 'document') =>
  `[...${within}.querySelectorAll(${q(selector)})].find((e) => ${shown} === ${q(text)})`
export const startsWith = (selector, text, within = 'document') =>
  `[...${within}.querySelectorAll(${q(selector)})].find((e) => ${shown}.startsWith(${q(text)}))`
export const navLink = (text) => byText('.nav-menu .nav-link', text)

/** A location's row in a location tree (the Locations and Units pages), by its name */
export const locationHeader = (name) =>
  `[...document.querySelectorAll('.location-header')].find((h) => h.querySelector('.location-name')?.innerText.trim() === ${q(name)})`

/** Open a location's branch of the location tree, once its row shows */
export async function expandLocation ({ page, input, name }) {
  await page.waitFor(`${locationHeader(name)}?.querySelector('.expand-btn')`, 30000)
  await input.click(`${locationHeader(name)}.querySelector('.expand-btn')`)
  await input.pause(700)
}

/** A study's card on the programs page, below its programme's and trial's, as an expression */
export function studyCard ({ programme, trial, study }) {
  const programmeCard = `[...document.querySelectorAll('.program-card')].find((c) => c.querySelector('.program-card-header h3')?.innerText.trim() === ${q(programme)})`
  const trialCard = `[...(${programmeCard})?.querySelectorAll('.trial-card') ?? []].find((c) => c.innerText.includes(${q(trial)}))`
  return {
    programmeCard,
    trialCard,
    studyCard: `[...(${trialCard})?.querySelectorAll('.study-card') ?? []].find((c) => c.innerText.includes(${q(study)}))`
  }
}

/** Programs, then the programme's trials and the trial's studies, until the study's card shows */
export async function openStudy ({ page, input, programme, trial, study }) {
  const cards = studyCard({ programme, trial, study })
  await input.click(navLink('Programs'))
  await page.waitFor(`${cards.programmeCard}?.querySelector('.trials-header')`, 30000)
  await input.pause(1500)
  await input.click(`${cards.programmeCard}.querySelector('.trials-header')`)
  await page.waitFor(`${cards.trialCard}?.querySelector('.studies-header')`, 30000)
  await input.pause(1200)
  await input.click(`${cards.trialCard}.querySelector('.studies-header')`)
  await page.waitFor(`${cards.studyCard}?.querySelector('.section-toggle')`, 30000)
  return cards
}

/**
 * In the open View datasets, every variable (the first, then the last with Shift) and the first factor; then the
 * study's licence, accepted, and Load Table. Off camera, if hold is given (the recorder's hold), the licence is
 * accepted as it was in an earlier chapter. A licence accepted already is not asked for again.
 */
export async function loadStudyData ({ page, input, hold = null }) {
  await page.waitFor(`document.querySelector('select[name=variableIds] option')`, 30000)
  await input.pause(1000)
  const variable = (name) => `[...document.querySelector('select[name=variableIds]').options].find((o) => o.text.trim() === ${q(name)})`
  const options = await page.evaluate(`[...document.querySelector('select[name=variableIds]').options].map((o) => o.text.trim())`)
  await input.click(variable(options[0]))
  await input.click(variable(options.at(-1)), { modifiers: ['Shift'] })
  await input.pause(500)
  await input.click(`[...document.querySelector('select[name=factorIds]').options][0]`)
  const loadTable = byText('.selection-actions button', 'Load Table')
  // the licence is checked once the data is chosen: asked for, or accepted already
  await input.pause(1500)
  await page.waitFor(`document.querySelector('.licence-agreement input') || !(${loadTable})?.disabled`, 30000)
  const asked = await page.evaluate(`!!document.querySelector('.licence-agreement input')`)
  const accept = async () => {
    await input.click('document.querySelector(".licence-agreement label.agree input")')
    await input.click('document.querySelector(".licence-agreement button.accept-licences")')
    await page.waitFor(`!document.querySelector('.licence-agreement input') && !(${loadTable})?.disabled`, 30000)
  }
  if (!asked) {
    await input.pause(600)
  } else if (hold) {
    await hold(accept)
  } else {
    await input.pause(800)
    await input.hover('document.querySelector(".licence-agreement")', 2200)
    await accept()
  }
  await input.click(loadTable)
  await page.waitFor(`document.querySelector('.curation-table tbody tr td')`, 60000)
}

/**
 * An offset for dragging a graph's node clear of its neighbours, so that its links and their labels show: to the spot
 * within reach (near, in pixels), in view and not under a control drawn over the graph, that leaves the most room
 * around the node and around the middle of each of its links (links: their elements), where the links' labels are.
 * margin keeps it that far inside the graph's edges, e.g. to leave room for what gatherLinked brings beside it.
 */
export const clearOf = (page, { node, nodes, links = null, frame, near = [140, 380], margin = null }) => page.evaluate(`(() => {
  const centre = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
  const el = ${node}
  const datum = el.__data__
  const p = centre(el)
  const svg = document.querySelector(${q(frame)})
  const box = svg.getBoundingClientRect()
  const view = {
    left: Math.max(box.left, 0) + ${margin ?? 80}, right: Math.min(box.right, innerWidth) - ${margin ?? 120},
    top: Math.max(box.top, 0) + ${margin ?? 50}, bottom: Math.min(box.bottom, innerHeight) - ${margin ?? 40}
  }
  // what is in the way: the other nodes, and every label but the node's own, by their boxes
  const boxes = [
    ...[...document.querySelectorAll(${q(nodes)})].filter((n) => n !== el),
    ...[...svg.querySelectorAll('text')].filter((t) => t.__data__ !== datum && t.textContent.trim())
  ].map((e) => e.getBoundingClientRect())
  const room = (x, y) => Math.min(...boxes.map((r) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))))
  // the other ends of the node's links
  const ends = ${links ? `[...document.querySelectorAll(${q(links)})].map((l) => l.__data__)
    .filter((l) => l && (l.source === datum || l.target === datum)).map((l) => (l.source === datum ? l.target : l.source))
    .map((d) => [...document.querySelectorAll(${q(nodes)})].find((n) => n.__data__ === d)).filter(Boolean).map(centre)` : '[]'}
  let best = null
  for (let x = view.left; x <= view.right; x += 24) {
    for (let y = view.top; y <= view.bottom; y += 24) {
      const reach = Math.hypot(x - p.x, y - p.y)
      if (reach < ${near[0]} || reach > ${near[1]}) continue
      const hit = document.elementFromPoint(x, y)
      if (!hit || !(hit === svg || svg.contains(hit))) continue
      const score = Math.min(room(x, y), ...ends.map((end) => room((x + end.x) / 2, (y + end.y) / 2)))
      if (!best || score > best.score) best = { x, y, score }
    }
  }
  return best ? { x: best.x - p.x, y: best.y - p.y } : { x: 0, y: 0 }
})()`)

/**
 * Drag each of a node's linked nodes (the other ends of its links) beside it, one by one, each to the clearest spot
 * around it (radius away), so that each link and its label stand clear of the rest of the graph. One out of the
 * graph's view is left where it is.
 */
export async function gatherLinked ({ page, input, node, nodes, links, frame, radius = 150 }) {
  const ends = `[...document.querySelectorAll(${q(links)})].map((l) => l.__data__)
    .filter((l) => l && (l.source === (${node}).__data__ || l.target === (${node}).__data__))
    .map((l) => (l.source === (${node}).__data__ ? l.target : l.source))
    .filter((end, index, all) => all.indexOf(end) === index)`
  const count = await page.evaluate(`${ends}.length`)
  for (let i = 0; i < count; i++) {
    const end = `[...document.querySelectorAll(${q(nodes)})].find((n) => n.__data__ === ${ends}[${i}])`
    const inView = await page.evaluate(`(() => {
      const r = (${end}).getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return hit === ${end} || !!hit?.closest?.(${q(frame)})
    })()`)
    if (!inView) continue
    const by = await page.evaluate(`(() => {
      const centre = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
      const hub = ${node}
      const moving = ${end}
      const h = centre(hub)
      const from = centre(moving)
      const svg = document.querySelector(${q(frame)})
      // what is in the way: every other node, the hub's too, and every label but the moving node's own
      const boxes = [
        ...[...document.querySelectorAll(${q(nodes)})].filter((n) => n !== moving),
        ...[...svg.querySelectorAll('text')].filter((t) => t.__data__ !== moving.__data__ && t.textContent.trim())
      ].map((e) => e.getBoundingClientRect())
      const room = (x, y) => Math.min(...boxes.map((r) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))))
      // the moving node's label, which moves with it: kept clear of the rest, by its corners and middle
      const label = [...svg.querySelectorAll('text')].find((t) => t.__data__ === moving.__data__ && t.textContent.trim())?.getBoundingClientRect()
      const labelRoom = (x, y) => {
        if (!label) return Infinity
        const dx = x - from.x, dy = y - from.y
        const points = [[label.left, label.top], [label.right, label.top], [label.left, label.bottom], [label.right, label.bottom],
          [(label.left + label.right) / 2, (label.top + label.bottom) / 2]]
        return Math.min(...points.map(([px, py]) => room(px + dx, py + dy)))
      }
      let best = null
      for (let degrees = 0; degrees < 360; degrees += 15) {
        const x = h.x + ${radius} * Math.cos(degrees * Math.PI / 180)
        const y = h.y + ${radius} * Math.sin(degrees * Math.PI / 180)
        if (x < 80 || y < 60 || x > innerWidth - 120 || y > innerHeight - 40) continue
        const hit = document.elementFromPoint(x, y)
        if (!hit || !(hit === svg || svg.contains(hit))) continue
        const score = Math.min(room(x, y), room((x + h.x) / 2, (y + h.y) / 2), labelRoom(x, y))
        if (!best || score > best.score) best = { x, y, score }
      }
      return best ? { x: best.x - from.x, y: best.y - from.y } : { x: 0, y: 0 }
    })()`)
    await input.drag(end, { by })
    await input.pause(600)
  }
}

// In an open tree picker (a hierarchical select or multiselect): its level loaded, and an option of it by its label
const levelLoaded = `!document.querySelector('.options-list .loading-state') && (document.querySelector('.options-list .option-label') || document.querySelector('.options-list .empty-state'))`
export const pickerOption = (label) =>
  `[...document.querySelectorAll('.options-list .option-item')].find((o) => o.querySelector('.option-label')?.innerText.trim() === ${q(label)})`

/**
 * Choose in a tree picker (a hierarchical select) as a person would: open it from its trigger, go down the path's
 * levels, and choose its last entry
 */
export async function chooseInTree ({ page, input, trigger, path }) {
  await input.click(trigger)
  for (const label of path.slice(0, -1)) {
    await page.waitFor(`${levelLoaded} && ${pickerOption(label)}?.querySelector('.expand-button')`, 30000)
    await input.click(`${pickerOption(label)}.querySelector('.expand-button')`)
  }
  await page.waitFor(`${levelLoaded} && ${pickerOption(path.at(-1))}`, 30000)
  await input.pause(500)
  await input.click(`${pickerOption(path.at(-1))}.querySelector('.option-label-button')`)
  await page.waitFor(`!document.querySelector('.options-list')`, 10000)
}

/** A select's option, chosen only when another is chosen: a control team or release already right is left alone */
export async function chooseUnlessChosen ({ page, input, select, option }) {
  if (await page.evaluate(`(${select}).selectedOptions[0]?.text.trim() === ${q(option)}`)) return
  await input.choose(select, option)
}
