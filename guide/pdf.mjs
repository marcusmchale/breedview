// Prints a collection of the user guide's chapters (src/guide/chapters.js, COLLECTIONS) to a PDF in A4, from its page
// /guide/print/<collection>, which puts each video's poster and a link to it in place of the video: for the data
// protection and legal offices (dpo), who review it before the demonstration site goes to them.
//
//   node guide/pdf.mjs [--collection dpo] [--app http://localhost:8081] [--site https://<the demonstration site>]
//
// The links to the videos name the site given, so a PDF printed from the recording stack points its readers at the
// hosted guide; without --site they name the app's own address. Written to public/guide-media/guide-<collection>.pdf,
// beside the media it shows.
import { parseArgs } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { launchBrowser } from '../tests/e2e/lib/browser.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { values: options } = parseArgs({
  options: {
    collection: { type: 'string', default: 'dpo' },
    app: { type: 'string', default: process.env.GUIDE_APP_URL || 'http://localhost:8081' },
    site: { type: 'string' }
  }
})
// as the print page takes it (GuidePrint.vue), which otherwise names its own address
if (options.site && !/^https?:\/\/[\w.-]+(:\d+)?$/.test(options.site)) {
  throw new Error(`--site takes an address such as https://demo.example.org, without a path: ${options.site}`)
}

const { page, close } = await launchBrowser({ width: 1100, height: 1400, acceptTerms: false })
try {
  await page.goto(`${options.app}/guide/print/${options.collection}${options.site ? `?site=${encodeURIComponent(options.site)}` : ''}`)
  await page.waitFor(`document.querySelector('.print-chapter') || document.querySelector('.guide-print p')`, 30000)
  if (!(await page.exists('.print-chapter'))) throw new Error(`No chapters in the collection ${options.collection}`)
  // every picture loaded, or given up on
  await page.waitFor(`[...document.images].every((image) => image.complete)`, 30000)
  const footer = `<div style="width:100%;font-size:8px;color:#888;text-align:center">
    BreedView user guide · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
  const pdf = await page.send('Page.printToPDF', {
    paperWidth: 8.27, paperHeight: 11.69, // A4, in inches
    marginTop: 0.6, marginBottom: 0.7, marginLeft: 0.6, marginRight: 0.6,
    printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer
  })
  const out = join(root, 'public/guide-media')
  mkdirSync(out, { recursive: true })
  const file = join(out, `guide-${options.collection}.pdf`)
  writeFileSync(file, Buffer.from(pdf.data, 'base64'))
  console.log(`Printed ${file}`)
} finally {
  await close()
}
