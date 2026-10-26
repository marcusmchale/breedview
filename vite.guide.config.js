import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderGuide } from './src/guide/renderGuide.js'

// The user guide as a static site of its own, for GitHub Pages (guide/README.md, The guide on GitHub Pages):
// guide-site/index.html and src/guideSite, with the guide's media from public/ (guide-media, which the workflow puts
// there from a release), built into dist-guide. Pages has no fallback to a single page app's index.html, so each
// chapter gets a copy of it, with the chapter's title and description, at guide/<chapter>/index.html, and 404.html is
// one too, for any other path.
const root = fileURLToPath(new URL('.', import.meta.url))

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')

function chapterPages () {
  let outDir
  return {
    name: 'guide-chapter-pages',
    apply: 'build',
    configResolved (config) { outDir = config.build.outDir },
    closeBundle () {
      const page = readFileSync(join(outDir, 'index.html'), 'utf8')
      const as = (title, description) => page
        .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${escape(description)}$2`)
      const write = (path, html) => {
        mkdirSync(join(outDir, path), { recursive: true })
        writeFileSync(join(outDir, path, 'index.html'), html)
      }
      write('guide', page)
      const chapters = join(root, 'src/guide/chapters')
      for (const file of readdirSync(chapters).filter((name) => name.endsWith('.md'))) {
        const { title, summary } = renderGuide(readFileSync(join(chapters, file), 'utf8'))
        write(`guide/${file.replace(/\.md$/, '')}`, as(`${title} - BreedView user guide`, plain(summary ?? '')))
      }
      writeFileSync(join(outDir, '404.html'), page)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_')
  return {
    root: join(root, 'guide-site'),
    base: env.VITE_BASE_PATH || '/',
    envDir: root,
    publicDir: join(root, 'public'),
    plugins: [vue(), chapterPages()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    build: {
      outDir: join(root, 'dist-guide'),
      emptyOutDir: true
    }
  }
})
