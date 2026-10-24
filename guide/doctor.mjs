// Checks what the guide's recordings need before they run (npm run guide:doctor): ffmpeg, the fonts the overlay and
// app are drawn with, the demonstration stack (a production build of the app, an API that is not the development one,
// the demonstration database's manifest), MailHog, Ireland's detailed map region, and room on the disk.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statfsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = process.env.GUIDE_APP_URL || 'http://localhost:8081'
const api = process.env.GUIDE_API_URL || 'http://localhost:8001'
const mailhog = process.env.MAILHOG_URL || 'http://localhost:8025'
const manifestPath = process.env.GUIDE_MANIFEST ||
  join(root, '../breedgraph/instance/neo4j_archive/demo_databases/demo_database.manifest.json')

const checks = []
const check = async (name, fn) => {
  try {
    const note = await fn()
    checks.push({ name, ok: true, note: note ?? '' })
  } catch (error) {
    checks.push({ name, ok: false, note: error.message })
  }
}
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim()

await check('ffmpeg and ffprobe', () => run('ffmpeg', ['-version']).split('\n')[0] + '; ' + run('ffprobe', ['-version']).split('\n')[0].split(' ').slice(0, 3).join(' '))
await check('Arial resolves to Liberation Sans', () => {
  const font = run('fc-match', ['Arial'])
  if (!font.includes('Liberation Sans')) throw new Error(`Arial is ${font}`)
  return font
})
await check(`the app on ${app} is a production build`, async () => {
  const html = await (await fetch(`${app}/`)).text()
  if (html.includes('/@vite/client')) throw new Error('it is the Vite dev server: run npm run guide:serve')
  // built for this API, not another (the build takes it from GUIDE_API_URL)
  const script = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1]
  const code = script ? await (await fetch(new URL(script, app))).text() : ''
  if (!code.includes(api)) throw new Error(`it was built for another API than ${api}: run npm run guide:serve again`)
  return `vite preview, built for ${api}`
})
await check(`the API on ${api} is not the development one`, async () => {
  if (new URL(api).port === '8000') throw new Error('port 8000 is the development API')
  const response = await fetch(`${api}/tiles/tiles.json`)
  if (!response.ok) throw new Error(`/tiles/tiles.json: HTTP ${response.status}`)
  const tiles = await response.json()
  if (!tiles.layers.some((layer) => layer.name === 'Ireland')) throw new Error("tiles.json has no Ireland region: fetch it with breedgraph's scripts/map_tiles.py --regions")
  return 'Ireland is in tiles.json'
})
await check('the demonstration database manifest', () => {
  if (!existsSync(manifestPath)) throw new Error(`no manifest at ${manifestPath}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.kind !== 'demo') throw new Error(`${manifestPath} is not the demonstration database's`)
  return `story ${manifest.story_version}, built ${manifest.built_at} from ${String(manifest.breedgraph_commit).slice(0, 7)}`
})
await check(`MailHog on ${mailhog}`, async () => {
  const response = await fetch(`${mailhog}/api/v2/messages?limit=1`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return `${(await response.json()).total} messages`
})
await check('room on the disk (2 GB)', () => {
  const { bavail, bsize } = statfsSync(root)
  const free = (bavail * bsize) / 1e9
  if (free < 2) throw new Error(`${free.toFixed(1)} GB free`)
  return `${free.toFixed(0)} GB free`
})

for (const { name, ok, note } of checks) console.log(`${ok ? '✓' : '✗'} ${name}${note ? `: ${note}` : ''}`)
if (checks.some((c) => !c.ok)) process.exit(1)
