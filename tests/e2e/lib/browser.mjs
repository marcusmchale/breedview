// Drives a headless Chrome over the DevTools protocol, with no dependencies beyond Node 22 (built-in WebSocket).
// launchBrowser() starts Chrome with a throwaway profile and returns a page driver; close() stops it.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_BIN || 'google-chrome'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function freePort() {
  const { createServer } = await import('node:net')
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)) })
  })
}

export async function launchBrowser({ headless = true, width = 1280, height = 900 } = {}) {
  const port = await freePort()
  const profile = mkdtempSync(join(tmpdir(), 'breedview-e2e-'))
  const args = [
    headless ? '--headless=new' : '', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'
  ].filter(Boolean)
  const chrome = spawn(CHROME, args, { stdio: 'ignore' })
  let version = null
  for (let attempt = 0; attempt < 50 && !version; attempt++) {
    await sleep(200)
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() } catch { /* not up yet */ }
  }
  if (!version) { chrome.kill(); rmSync(profile, { recursive: true, force: true }); throw new Error(`Chrome did not start (${CHROME})`) }
  const page = await connectPage(port)
  return {
    page,
    close: async () => { try { page.close() } catch { /* ignore */ } chrome.kill(); await sleep(300); rmSync(profile, { recursive: true, force: true }) }
  }
}

// After this many full page loads, goto() moves to a fresh tab: with the dev server's unbundled modules (hundreds of
// requests per load), Chrome refuses further loads in a tab after a dozen or so (net::ERR_INSUFFICIENT_RESOURCES) and
// the app no longer renders; the production build does not have this problem. Cookies live in the profile, so the
// session carries over to the new tab.
const LOADS_PER_TAB = 10

async function connectPage(port) {
  const events = []  // every tab's events in one list, so marks stay valid across tabs
  let ws, target, nextId = 0
  const pending = new Map()

  const open = async (newTarget) => {
    target = newTarget
    ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
    ws.onmessage = (message) => {
      const msg = JSON.parse(message.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      } else if (msg.method) {
        events.push(msg)
        // a native dialog blocks the page, and with it every evaluate, until it is answered: accept it (a confirm is
        // confirmed); an alert is reported among the console errors
        if (msg.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
      }
    }
    for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await send(`${domain}.enable`)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  await open(list.find((t) => t.type === 'page') ??
    await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json())

  let loads = 0
  const freshTab = async () => {
    const old = target
    const oldWs = ws
    await open(await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json())
    try { oldWs.close() } catch { /* ignore */ }
    await fetch(`http://127.0.0.1:${port}/json/close/${old.id}`).catch(() => {})
    loads = 0
  }

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error('JS error: ' + (result.exceptionDetails.exception?.description || result.exceptionDetails.text))
    return result.result.value
  }
  const q = JSON.stringify

  return {
    send, events, sleep, evaluate,
    goto: async (url) => {
      if (++loads > LOADS_PER_TAB) { await freshTab(); loads = 1 }
      await send('Page.navigate', { url }); await sleep(1500)
    },
    url: () => evaluate('location.href'),
    text: (selector = 'body') => evaluate(`document.querySelector(${q(selector)})?.innerText ?? null`),
    exists: (selector) => evaluate(`!!document.querySelector(${q(selector)})`),
    // wait until a JS expression is truthy, returning the elapsed milliseconds
    waitFor: async (expression, timeout = 15000) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await evaluate(`!!(${expression})`)) return Date.now() - start
        await sleep(150)
      }
      throw new Error('Timeout waiting for: ' + expression)
    },
    // set a value the way a user would, so Vue and FormKit see the input
    type: (selector, value) => evaluate(`(() => {
      const el = document.querySelector(${q(selector)}); if (!el) throw new Error('no element ' + ${q(selector)});
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : (el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype);
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${q(value)});
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`),
    check: (selector, checked = true) => evaluate(`(() => {
      const el = document.querySelector(${q(selector)}); if (!el) throw new Error('no element ' + ${q(selector)});
      if (el.checked !== ${checked}) el.click(); return el.checked })()`),
    click: (selector) => evaluate(`(() => { const el = document.querySelector(${q(selector)}); if (!el) throw new Error('no element ' + ${q(selector)}); el.click(); return true })()`),
    // click the first element of a tag whose text includes the given text
    clickText: (text, tag = 'button') => evaluate(`(() => {
      const el = [...document.querySelectorAll(${q(tag)})].find((e) => e.innerText.trim().includes(${q(text)}));
      if (!el) throw new Error('no ' + ${q(tag)} + ' with text ' + ${q(text)}); el.click(); return true })()`),
    screenshot: async (path) => {
      const result = await send('Page.captureScreenshot', { format: 'png' })
      mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, Buffer.from(result.data, 'base64')); return path
    },
    heapMB: async () => Math.round((await send('Runtime.getHeapUsage')).usedSize / 1048576),
    mark: () => events.length,
    // GraphQL requests seen since a mark: operation name, duration and bytes
    graphql: (since = 0) => {
      const requests = new Map()
      for (const event of events.slice(since)) {
        const p = event.params
        if (event.method === 'Network.requestWillBeSent' && p.request?.url?.includes('/graphql') && p.request.postData) {
          let op = '?'
          try { const body = JSON.parse(p.request.postData); op = body.operationName || (body.query || '').match(/(query|mutation)\s+(\w+)/)?.[2] || '?' } catch { /* not JSON */ }
          requests.set(p.requestId, { op, start: p.timestamp, bytes: 0 })
        } else if (event.method === 'Network.loadingFinished' && requests.has(p.requestId)) {
          const r = requests.get(p.requestId); r.ms = Math.round((p.timestamp - r.start) * 1000); r.bytes = p.encodedDataLength
        }
      }
      return [...requests.values()].filter((r) => r.ms != null)
    },
    // GraphQL requests since a mark that returned errors, at the top level or in their payload, as "operation: messages"
    graphqlErrors: async (since = 0) => {
      const operations = new Map()
      for (const event of events.slice(since)) {
        const p = event.params
        if (event.method === 'Network.requestWillBeSent' && p.request?.url?.includes('/graphql') && p.request.postData) {
          let op = '?'
          try { const body = JSON.parse(p.request.postData); op = body.operationName || (body.query || '').match(/(query|mutation)\s+(\w+)/)?.[2] || '?' } catch { /* not JSON */ }
          operations.set(p.requestId, op)
        }
      }
      const failures = []
      for (const [requestId, op] of operations) {
        let json
        try { json = JSON.parse((await send('Network.getResponseBody', { requestId })).body) } catch { continue }
        const payload = json.data ? Object.values(json.data)[0] : null
        const messages = [...(json.errors ?? []), ...(payload?.errors ?? [])].map((e) => e.message)
        if (messages.length) failures.push(`${op}: ${[...new Set(messages)].join('; ')}`)
      }
      return [...new Set(failures)]
    },
    consoleErrors: (since = 0) => events.slice(since)
      .filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
        (e.method === 'Page.javascriptDialogOpening' && e.params.type === 'alert'))
      .map((e) => e.method === 'Runtime.exceptionThrown' ? e.params.exceptionDetails.exception?.description
        : e.method === 'Page.javascriptDialogOpening' ? `alert: ${e.params.message}`
          : e.params.args.map((a) => a.value ?? a.description).join(' ')),
    close: () => ws.close()
  }
}
