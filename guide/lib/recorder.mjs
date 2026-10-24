// Records a page for a guide video (guide/record.mjs): Page.startScreencast's frames, each acknowledged at once and
// written with the time it was shown, and the times the storyboard's steps start, to timeline.json. Chrome sends a frame
// only when something changes, so each frame lasts until the next (encode.mjs).
// What happens off camera (offCamera), or while a page loads (hold), is cut: frames shown meanwhile are dropped, by
// their own timestamps, and the clock skips the time, so the video goes straight on to what follows.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const now = () => Date.now() / 1000

export function createRecorder (page, { dir }) {
  const framesDir = `${dir}/frames`
  const frames = []
  const steps = []
  const cuts = [] // { from, to, label } in seconds since the epoch, as frame timestamps are
  let started = null
  let stopped = false

  const cutBefore = (t) => cuts.reduce((sum, cut) => sum + (cut.to != null && cut.to <= t ? cut.to - cut.from : 0), 0)
  const inCut = (t) => cuts.some((cut) => t >= cut.from && (cut.to == null || t <= cut.to))
  const videoTime = (t) => t - started - cutBefore(t)

  page.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    page.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    if (started == null || stopped || inCut(metadata.timestamp)) return
    const file = `${String(frames.length).padStart(5, '0')}.jpg`
    writeFileSync(`${framesDir}/${file}`, Buffer.from(data, 'base64'))
    frames.push({ t: videoTime(metadata.timestamp), file })
  })

  // a change to paint, so a frame comes for a page that is otherwise still: after a cut, and at the start
  const nudge = () => page.evaluate('window.__recorderOverlay?.nudge()').catch(() => {})

  const recorder = {
    async start () {
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(framesDir, { recursive: true })
      started = now()
      await page.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
      await nudge()
    },

    /** The storyboard's step starts now */
    step (id) {
      if (started != null) steps.push({ id, t: videoTime(now()) })
    },

    /** Run fn with the camera off: its time is cut, and the video goes on from what fn leaves */
    async hold (fn, { label = null } = {}) {
      if (started == null) return fn()
      const cut = { from: now(), to: null, label }
      cuts.push(cut)
      try {
        return await fn()
      } finally {
        // a moment for the last frames of fn to be sent, and dropped
        await page.sleep(200)
        cut.to = now()
        await nudge()
      }
    },

    /** Work done off camera, after which a chip says what was done: "Later: 35 more plots" */
    async offCamera (fn, { label } = {}) {
      const result = await recorder.hold(fn, { label })
      if (label && started != null) {
        await page.evaluate(`window.__recorderOverlay?.chip(${JSON.stringify(label)})`)
        await page.sleep(1600)
      }
      return result
    },

    /** A full-size picture of the page now (or of clip, in CSS pixels), for the written guide */
    async still (name, { clip } = {}) {
      mkdirSync(`${dir}/stills`, { recursive: true })
      const shot = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) })
      writeFileSync(`${dir}/stills/${name}.png`, Buffer.from(shot.data, 'base64'))
    },

    async stop () {
      if (started == null || stopped) return
      await page.sleep(1200)
      const end = videoTime(now())
      await page.send('Page.stopScreencast').catch(() => {})
      stopped = true
      writeFileSync(`${dir}/timeline.json`, JSON.stringify({ frames, steps, cuts: cuts.map((cut) => ({
        at: videoTime(cut.from), length: cut.to - cut.from, label: cut.label
      })), end }, null, 1))
      return { frames: frames.length, steps: steps.length, end }
    }
  }
  return recorder
}
