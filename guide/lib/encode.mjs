// Encodes a recording (recorder.mjs's frames and timeline.json) for the guide: an H.264 MP4 at 30 fps (BT.709,
// faststart), its WebVTT captions, one cue for each step with the step's id and the lead its chapter gives it now (so a
// caption is reworded in the chapter alone, then encoded again), and a poster. Each frame lasts until the next.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

// the last frame is held this long, so the video doesn't stop on its last change
const END_HOLD = 1.5

const stamp = (seconds) => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23)

/**
 * dir: the recording's (frames/, timeline.json); steps: the chapter's [{ id, lead }]; out: where the media go, as
 * <name>.mp4, <name>.vtt and <name>.jpg. Returns what ffprobe says of the video.
 */
export function encode ({ dir, steps, out, name }) {
  const timeline = JSON.parse(readFileSync(`${dir}/timeline.json`, 'utf8'))
  if (timeline.frames.length === 0) throw new Error(`${dir} has no frames`)
  // the video starts with the first step, on the frame then shown: not the blank page before the storyboard's first
  const start = timeline.steps[0]?.t ?? timeline.frames[0].t
  const first = Math.max(0, timeline.frames.findLastIndex((frame) => frame.t <= start))
  const frames = timeline.frames.slice(first).map((frame, i) => (i === 0 ? { ...frame, t: Math.max(frame.t, start) } : frame))
  const leads = Object.fromEntries(steps.map((step) => [step.id, step.lead]))
  const missing = timeline.steps.filter((step) => !leads[step.id]).map((step) => step.id)
  if (missing.length) throw new Error(`The chapter has no step ${missing.join(', ')}: record again`)

  const t0 = frames[0].t
  const end = Math.max(timeline.end, frames.at(-1).t) - t0 + END_HOLD
  const list = ['ffconcat version 1.0']
  frames.forEach((frame, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].t - t0 : end
    list.push(`file '${dir}/frames/${frame.file}'`, `duration ${(next - (frame.t - t0)).toFixed(4)}`)
  })
  // the concat demuxer holds the last file's duration only if it is listed again
  list.push(`file '${dir}/frames/${frames.at(-1).file}'`)
  writeFileSync(`${dir}/frames.ffconcat`, list.join('\n') + '\n')

  mkdirSync(out, { recursive: true })
  const video = `${out}/${name}.mp4`
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/frames.ffconcat`,
    '-vf', 'fps=30,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', video])

  const cues = ['WEBVTT', '']
  timeline.steps.forEach((step, i) => {
    const from = step.t - t0
    const to = i + 1 < timeline.steps.length ? timeline.steps[i + 1].t - t0 : end
    cues.push(step.id, `${stamp(from)} --> ${stamp(to)}`, leads[step.id], '')
  })
  writeFileSync(`${out}/${name}.vtt`, cues.join('\n'))

  // the poster: the frame the storyboard chose (recorder.poster), else the second step's opening, past the Terms most
  // chapters start with, else the first frame
  const posterAt = timeline.poster != null
    ? Math.max(0, timeline.poster - t0)
    : Math.max(0, (timeline.steps[1] ?? timeline.steps[0])?.t - t0 + 1.5 || 0)
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', posterAt.toFixed(2), '-i', video, '-frames:v', '1', '-q:v', '3',
    `${out}/${name}.jpg`])

  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,color_space:format=duration,size', '-of', 'json', video])
  const { streams: [stream], format } = JSON.parse(probe)
  return { ...stream, duration: Number(format.duration), size: Number(format.size), video, captions: existsSync(`${out}/${name}.vtt`) }
}
