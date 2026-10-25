// What the recorder adds to every page before the app's scripts (Page.addScriptToEvaluateOnNewDocument): a cursor that
// follows the mouse events the recorder sends, with a ripple where it presses, and stand-ins for what a headless
// browser's frames don't show: a select's menu, a confirm dialog, key presses, and cards for emails, files and the
// clipboard. All in a closed shadow root that takes no pointer events, so the app neither sees nor styles it.
// Also: window.confirm answered by the recorder (a click first asks; the recorder answers and clicks again), and the
// Leaflet maps the app makes, collected as they are made, so points on them can be clicked.
(() => {
  if (window.__recorderOverlay) return

  // confirm(): the first call keeps the question and says no; the recorder shows it, answers, and clicks again
  const confirmState = { answer: null, asked: [] }
  window.__recorderConfirm = confirmState
  window.confirm = (message) => {
    if (confirmState.answer !== null) {
      const answer = confirmState.answer
      confirmState.answer = null
      return answer
    }
    confirmState.asked.push(String(message))
    return false
  }

  // Leaflet sets window.L as it loads: add an init hook then, collecting every map made
  let leaflet
  Object.defineProperty(window, 'L', {
    configurable: true,
    get: () => leaflet,
    set: (value) => {
      leaflet = value
      if (value?.Map?.addInitHook && !value.__recorderHooked) {
        value.__recorderHooked = true
        value.Map.addInitHook(function () { (window.__recorderMaps ??= []).push(this) })
      }
    }
  })

  const STYLE = `
    * { box-sizing: border-box; }
    .cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; transform: translate(-200px, -200px);
      filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.35)); z-index: 4; }
    .ripple { position: fixed; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
      border: 3px solid rgba(25, 118, 210, .85); animation: ripple .45s ease-out forwards; z-index: 3; }
    @keyframes ripple { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
    .layer { position: fixed; font: 14px/1.4 Arial, "Liberation Sans", sans-serif; color: #212121; z-index: 2; }
    .keys { left: 50%; bottom: 28px; transform: translateX(-50%); display: flex; gap: 6px; }
    .key { background: #fafafa; border: 1px solid #bdbdbd; border-bottom-width: 3px; border-radius: 6px;
      padding: 4px 10px; font-weight: bold; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
    .chip { left: 50%; top: 18px; transform: translateX(-50%); background: rgba(33,33,33,.88); color: #fff;
      padding: 6px 16px; border-radius: 16px; font-size: 15px; }
    .menu { background: #fff; border: 1px solid #9e9e9e; box-shadow: 0 4px 14px rgba(0,0,0,.25); padding: 2px 0;
      font-size: 13px; overflow: hidden; }
    .menu div { padding: 3px 8px; white-space: nowrap; }
    .menu .current { background: #e3f2fd; }
    .menu .chosen { background: #1976d2; color: #fff; }
    .shade { inset: 0; background: rgba(0,0,0,.25); }
    .dialog { left: 50%; top: 22%; transform: translateX(-50%); width: 440px; background: #fff; border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,.35); padding: 18px 20px 14px; }
    .dialog .title { font-size: 12px; color: #757575; margin-bottom: 8px; }
    .dialog .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .dialog .buttons span { padding: 6px 16px; border-radius: 4px; border: 1px solid #bdbdbd; }
    .dialog .buttons .ok { background: #1976d2; border-color: #1976d2; color: #fff; }
    .card { right: 24px; top: 80px; width: 380px; background: #fff; border-radius: 8px; padding: 14px 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,.3); border-top: 4px solid #1976d2; }
    .card .kind { font-size: 12px; color: #757575; text-transform: uppercase; letter-spacing: .04em; }
    .card .heading { font-weight: bold; margin: 4px 0 8px; }
    .card pre { font: 12px/1.35 "Liberation Mono", monospace; margin: 0; white-space: pre-wrap; max-height: 260px;
      overflow: hidden; }
    .tip { background: rgba(33,33,33,.92); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 13px;
      max-width: 420px; }
    .nudge { left: 0; top: 0; width: 1px; height: 1px; }
  `
  const install = () => {
    const host = document.createElement('div')
    host.setAttribute('data-recorder-overlay', '')
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict'
    const root = host.attachShadow({ mode: 'closed' })
    root.innerHTML = `<style>${STYLE}</style>
      <svg class="cursor" viewBox="0 0 22 22"><path d="M2 1.5 L2 18 L6.4 13.9 L9.4 20.6 L12.3 19.4 L9.4 12.8 L15.6 12.8 Z"
        fill="#1a1a1a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`
    document.documentElement.appendChild(host)
    // no spelling marks under what is typed: they follow the recording browser's language, not the viewer's
    document.documentElement.spellcheck = false
    const cursor = root.querySelector('.cursor')
    const make = (className, html = '') => {
      const element = document.createElement('div')
      element.className = `layer ${className}`
      element.innerHTML = html
      root.appendChild(element)
      return element
    }
    const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    const shown = {}
    const show = (name, element, ms) => {
      shown[name]?.remove()
      shown[name] = element
      if (ms) setTimeout(() => { if (shown[name] === element) hide(name) }, ms)
    }
    const hide = (name) => { shown[name]?.remove(); delete shown[name] }

    const place = (x, y) => { cursor.style.transform = `translate(${x}px, ${y}px)` }
    const ripple = (x, y) => {
      const element = document.createElement('div')
      element.className = 'ripple'
      element.style.left = `${x}px`; element.style.top = `${y}px`
      root.appendChild(element)
      setTimeout(() => element.remove(), 500)
    }
    addEventListener('mousemove', (e) => place(e.clientX, e.clientY), { capture: true, passive: true })
    addEventListener('mousedown', (e) => ripple(e.clientX, e.clientY), { capture: true, passive: true })

    window.__recorderOverlay = {
      place,
      ripple,
      // keys pressed, as caps: ['Ctrl', 'V']
      keys: (names, ms = 1300) => show('keys', make('keys', names.map((n) => `<span class="key">${escape(n)}</span>`).join('')), ms),
      // a note on what happens off camera, e.g. "Later: 35 more plots"
      chip: (text, ms = 2200) => show('chip', make('chip', escape(text)), ms),
      // a select's menu, as the browser would draw it below the select: options, the current one and the one chosen
      menu: ({ left, top, width }, options, current, chosen = null) => {
        const element = make('menu', options.map((o, i) =>
          `<div class="${i === chosen ? 'chosen' : i === current ? 'current' : ''}">${escape(o)}</div>`).join(''))
        Object.assign(element.style, { left: `${left}px`, top: `${top}px`, minWidth: `${width}px` })
        show('menu', element)
        return [...element.children].map((option) => {
          const r = option.getBoundingClientRect()
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        })
      },
      hideMenu: () => hide('menu'),
      // a confirm dialog, as the browser would show it: the question and where its OK button is
      confirm: (message) => {
        show('shade', make('shade'))
        const element = make('dialog', `<div class="title">${escape(location.host)} says</div><div>${escape(message)}</div>
          <div class="buttons"><span>Cancel</span><span class="ok">OK</span></div>`)
        show('dialog', element)
        const r = element.querySelector('.ok').getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      },
      hideConfirm: () => { hide('dialog'); hide('shade') },
      // an email, a file chosen or what is on the clipboard: { kind, heading, text }
      card: ({ kind, heading, text }, ms = 0) => show('card', make('card',
        `<div class="kind">${escape(kind)}</div><div class="heading">${escape(heading)}</div><pre>${escape(text ?? '')}</pre>`), ms),
      hideCard: () => hide('card'),
      // an element's title, as a tooltip below the pointer would show it
      tip: ({ x, y }, text, ms = 0) => {
        const element = make('tip', escape(text))
        Object.assign(element.style, { left: `${x + 12}px`, top: `${y + 22}px` })
        show('tip', element, ms)
      },
      hideTip: () => hide('tip'),
      // a change to paint, so the screencast sends a frame of a page that is otherwise still
      nudge: () => {
        const element = make('nudge')
        element.style.opacity = String(Math.random() / 100)
        show('nudge', element, 50)
      }
    }
  }
  if (document.documentElement) install()
  else document.addEventListener('readystatechange', install, { once: true })
})()
