// Real input for the guide's recordings (guide/record.mjs), sent as a person's: the mouse moves along eased paths,
// presses and releases, so hover and active states show; keys are typed one at a time. Each target, a JS expression
// for an element, is checked before it is touched: there, in view (scrolled to if not), visible, enabled, still and not
// covered, so a storyboard fails where a person could not do what it does. What a headless browser's frames don't show,
// a select's menu, a confirm dialog, a file chooser, the clipboard and tooltips, the overlay (overlay.js) draws.
// With fast, nothing is eased or paused: for checking storyboards (npm run guide:check).

const q = JSON.stringify
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// a small seeded generator, so a storyboard's paths and typing are the same in every recording
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const KEYS = {
  Enter: { code: 'Enter', keyCode: 13, text: '\r' },
  Escape: { code: 'Escape', keyCode: 27 },
  Tab: { code: 'Tab', keyCode: 9 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  v: { code: 'KeyV', keyCode: 86 },
  a: { code: 'KeyA', keyCode: 65 }
}
const MODIFIERS = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 }

export function createInput (page, { fast = false, seed = 1 } = {}) {
  const random = seeded(seed)
  const send = page.send
  const wait = (ms) => (fast ? Promise.resolve() : page.sleep(ms))
  const overlay = (call) => page.evaluate(`window.__recorderOverlay?.${call}`)
  let mouse = { x: 640, y: 400 }

  // pressed: the left button held, as in a drag
  const moveTo = async (x, y, { pressed = false } = {}) => {
    const held = pressed ? { button: 'left', buttons: 1 } : {}
    const from = mouse
    const distance = Math.hypot(x - from.x, y - from.y)
    if (fast || distance < 1) {
      mouse = { x, y }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, ...held })
      return
    }
    const steps = Math.max(8, Math.round(Math.min(900, 280 + distance * 0.55) / 16))
    // a slight arc, as a hand makes: a control point off the straight line
    const bend = (random() - 0.5) * Math.min(90, distance * 0.18)
    const cx = (from.x + x) / 2 - ((y - from.y) / distance) * bend
    const cy = (from.y + y) / 2 + ((x - from.x) / distance) * bend
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps)
      mouse = {
        x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * x,
        y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * y
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y, ...held })
      await page.sleep(16)
    }
  }

  const describe = (target) => `(${target})`
  // where a target is, as a person would find it: { x, y, rect } of its centre, or { problem }
  const probe = (target, enabled) => page.evaluate(`(() => {
    const el = ${describe(target)}
    if (!el) return { problem: 'not found' }
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') return { problem: 'not visible' }
    if (${enabled} && el.disabled) return { problem: 'disabled' }
    if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return { problem: 'out of view', scroll: true }
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    const hit = document.elementFromPoint(x, y)
    const reaches = hit === el || el.contains(hit) || hit?.contains(el) || [...(el.labels ?? [])].some((l) => l.contains(hit))
    if (!reaches) return { problem: 'covered by ' + (hit?.outerHTML.slice(0, 100) ?? 'nothing') }
    return { x, y, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }
  })()`)

  /**
   * A target's centre once it can be touched: scrolled into view if need be, and still for a moment, unless still is
   * false (a graph's node, drifting as its layout settles, is grabbed where it is)
   */
  const locate = async (target, { enabled = true, timeout = 20000, still = true } = {}) => {
    const deadline = Date.now() + timeout
    let found = null
    while (Date.now() < deadline) {
      found = await probe(target, enabled).catch((error) => ({ problem: error.message }))
      if (found.scroll) {
        await page.evaluate(`${describe(target)}.scrollIntoView({ block: 'center', inline: 'nearest', behavior: ${q(fast ? 'instant' : 'smooth')} })`)
        await page.sleep(fast ? 50 : 700)
        continue
      }
      if (!found.problem) {
        if (!still) return found
        await page.sleep(fast ? 30 : 100)
        const again = await probe(target, enabled).catch(() => ({ problem: 'gone' }))
        if (!again.problem && Math.abs(again.x - found.x) < 1 && Math.abs(again.y - found.y) < 1) return again
        continue
      }
      await page.sleep(150)
    }
    throw new Error(`Can't reach ${target}: ${found?.problem}`)
  }

  const pressAt = async (x, y, { modifiers = 0 } = {}) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers })
    await wait(80)
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers })
  }

  const key = async (name, { modifiers = [], commands = [], show = true } = {}) => {
    const spec = KEYS[name] ?? { code: `Key${name.toUpperCase()}`, keyCode: name.toUpperCase().charCodeAt(0) }
    const flags = modifiers.reduce((sum, m) => sum | MODIFIERS[m], 0)
    if (show && !fast) await overlay(`keys(${q([...modifiers, name.length === 1 ? name.toUpperCase() : name])})`)
    await send('Input.dispatchKeyEvent', {
      type: spec.text && !flags ? 'keyDown' : 'rawKeyDown', key: name, code: spec.code, windowsVirtualKeyCode: spec.keyCode,
      modifiers: flags, text: flags ? undefined : spec.text, commands
    })
    await wait(60)
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: spec.code, windowsVirtualKeyCode: spec.keyCode, modifiers: flags })
  }

  const input = {
    get position () { return { ...mouse } },
    moveTo,
    locate,
    pause: (ms) => wait(ms),

    /** Point at a target, and wait as a reader would */
    hover: async (target, ms = 600) => {
      const { x, y } = await locate(target, { enabled: false })
      await moveTo(x, y)
      await wait(ms)
    },

    /** Click a target where a person would, holding modifiers (['Shift']) if given */
    click: async (target, { modifiers = [] } = {}) => {
      const { x, y } = await locate(target)
      await moveTo(x, y)
      await wait(140)
      await pressAt(x, y, { modifiers: modifiers.reduce((sum, m) => sum | MODIFIERS[m], 0) })
      await wait(380)
    },

    /** Drag a target by an offset, as a hand would: pressed, moved along a path and let go, e.g. a graph's node */
    drag: async (target, { by }) => {
      const found = await locate(target, { enabled: false, still: false })
      await moveTo(found.x, found.y)
      await wait(250)
      // where it is now, should it have drifted on the way
      const now = await probe(target, false).catch(() => found)
      const { x, y } = now.problem ? found : now
      await moveTo(x, y)
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await wait(150)
      await moveTo(x + by.x, y + by.y, { pressed: true })
      await wait(150)
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mouse.x, y: mouse.y, button: 'left', clickCount: 1 })
      await wait(500)
    },

    /** Click a point, e.g. on a map, given in the page's coordinates */
    clickAt: async ({ x, y }) => {
      await moveTo(x, y)
      await wait(140)
      await pressAt(x, y)
      await wait(300)
    },

    /** Type into a target, after clicking it: what it holds is replaced */
    type: async (target, text, { replace = true } = {}) => {
      await input.click(target)
      if (replace) await page.evaluate(`(() => { const el = ${describe(target)}; el.select?.() })()`)
      if (fast) {
        await send('Input.insertText', { text })
      } else {
        for (const character of text) {
          await send('Input.insertText', { text: character })
          await page.sleep(55 + Math.round(random() * 70))
        }
      }
      await wait(300)
    },

    key,

    /** Choose an option of a native select, by its text: the overlay draws the menu a click would open */
    choose: async (target, optionText) => {
      const { x, y } = await locate(target)
      await moveTo(x, y)
      await wait(140)
      const select = await page.evaluate(`(() => { const s = ${describe(target)}; const r = s.getBoundingClientRect();
        return { rect: { left: r.left, top: r.bottom + 2, width: r.width }, options: [...s.options].map((o) => o.text.trim()),
          current: s.selectedIndex } })()`)
      const index = select.options.indexOf(optionText)
      if (index < 0) throw new Error(`${target} has no option ${optionText}: ${select.options.join(', ')}`)
      await overlay(`ripple(${x}, ${y})`)
      const points = await overlay(`menu(${q(select.rect)}, ${q(select.options)}, ${select.current})`)
      await wait(450)
      await moveTo(points[index].x, points[index].y)
      await wait(250)
      await overlay(`menu(${q(select.rect)}, ${q(select.options)}, ${select.current}, ${index})`)
      await overlay(`ripple(${points[index].x}, ${points[index].y})`)
      await wait(200)
      await page.evaluate(`(() => { const s = ${describe(target)}; s.selectedIndex = ${index};
        s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }))
        window.__recorderOverlay?.hideMenu() })()`)
      await wait(400)
    },

    /** After a click that asks to confirm: show the question, click its OK, and click the target again to go on */
    confirm: async (target, { answer = true } = {}) => {
      const asked = await page.evaluate('window.__recorderConfirm?.asked.at(-1) ?? null')
      if (!asked) throw new Error(`No confirm was asked after clicking ${target}`)
      if (!fast) {
        const ok = await overlay(`confirm(${q(asked)})`)
        await wait(900)
        await moveTo(ok.x, ok.y)
        await wait(200)
        await overlay(`ripple(${ok.x}, ${ok.y})`)
        await wait(250)
      }
      await page.evaluate(`window.__recorderOverlay?.hideConfirm(); window.__recorderConfirm.answer = ${answer};
        ${describe(target)}.click()`)
      await wait(400)
    },

    /** Paste text into a target, as from a spreadsheet: the overlay shows the clipboard, then Ctrl+V */
    paste: async (target, text, { heading = 'Copied from the field sheet' } = {}) => {
      const origin = new URL(await page.evaluate('location.href')).origin
      await send('Browser.grantPermissions', { origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
      if (!fast) await overlay(`card(${q({ kind: 'Clipboard', heading, text })})`)
      await wait(1200)
      await input.click(target)
      await page.evaluate(`navigator.clipboard.writeText(${q(text)})`)
      await key('v', { modifiers: ['Ctrl'], commands: ['paste'] })
      await wait(700)
      await overlay('hideCard()')
    },

    /** Choose a file in a file input, through the file chooser a click opens, drawn by the overlay */
    chooseFile: async (target, path, { name = path.split('/').at(-1) } = {}) => {
      await send('Page.setInterceptFileChooserDialog', { enabled: true })
      const mark = page.mark()
      await input.click(target)
      let opened = null
      for (let i = 0; i < 50 && !opened; i++) {
        opened = page.events.slice(mark).find((event) => event.method === 'Page.fileChooserOpened')?.params ?? null
        if (!opened) await page.sleep(100)
      }
      await send('Page.setInterceptFileChooserDialog', { enabled: false })
      if (!opened) throw new Error(`No file chooser opened from ${target}`)
      if (!fast) await overlay(`card(${q({ kind: 'Choose a file', heading: name, text: '' })})`)
      await wait(1200)
      await send('DOM.setFileInputFiles', { files: [path], backendNodeId: opened.backendNodeId })
      await overlay('hideCard()')
      await wait(500)
    },

    /** Point at a target and show its title, as a tooltip would */
    tooltip: async (target, ms = 1800) => {
      const { x, y } = await locate(target, { enabled: false })
      await moveTo(x, y)
      const title = await page.evaluate(`${describe(target)}.title`)
      if (!fast && title) await overlay(`tip(${q({ x, y })}, ${q(title)})`)
      await wait(ms)
      await overlay('hideTip()')
    },

    /**
     * Scroll with the mouse wheel over a target, or at a point (at: { x, y }) where something under the pointer would
     * take the wheel itself, as a graph zooms with it; else where the pointer is. By dy pixels, in small steps
     */
    scroll: async (target, dy, { at = null } = {}) => {
      if (target) {
        const { x, y } = await locate(target, { enabled: false })
        await moveTo(x, y)
      } else if (at) {
        await moveTo(at.x, at.y)
      }
      const step = Math.sign(dy) * 60
      for (let done = 0; Math.abs(done) < Math.abs(dy); done += step) {
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: mouse.x, y: mouse.y, deltaX: 0, deltaY: step })
        await page.sleep(fast ? 0 : 24)
      }
      await wait(500)
    },

    /** Where a latitude and longitude are on the page's Leaflet map, for clicking it */
    mapPoint: (latitude, longitude) => page.evaluate(`(() => {
      const map = (window.__recorderMaps ?? []).find((m) => m.getContainer().isConnected)
      if (!map) throw new Error('no map')
      const r = map.getContainer().getBoundingClientRect(), p = map.latLngToContainerPoint([${latitude}, ${longitude}])
      return { x: r.left + p.x, y: r.top + p.y }
    })()`),

    /** After a navigation the new page's cursor starts hidden: show it where the mouse is */
    restoreCursor: () => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y })
  }
  return input
}
