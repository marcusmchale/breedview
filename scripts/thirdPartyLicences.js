// The licences of the third-party code a build bundles (README.md, Third-party software and data): each npm package
// whose modules are in the bundle, with its version and licence and its own licence file, written as licenses.txt
// beside the build, which the site's footer links to. MIT, ISC and BSD ask that their notices go with every copy, and
// visitors' browsers are given a copy, minified, which keeps few of them.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const LICENSES_FILE = 'licenses.txt'

const LICENCE_FILE = /^(licen[cs]e|copying)([-.](md|txt|mit|bsd))?$/i
const NODE_MODULES = '/node_modules/'

// The standard texts of the licences bundled packages use, for a package that ships no licence file of its own: its
// author, as its package.json gives it, stands for the copyright holder
const STANDARD_TEXTS = {
  MIT: (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  'BSD-3-Clause': (holder) => `BSD 3-Clause License

Copyright (c) ${holder}

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote
   products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`
}

/** The package a bundled module is part of, { name, root }, or null for the project's own modules */
export function modulePackage(id) {
  const path = id.replace(/^\0/, '').split('?')[0]
  const at = path.lastIndexOf(NODE_MODULES)
  if (at < 0) return null
  const parts = path.slice(at + NODE_MODULES.length).split('/')
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  return { name, root: path.slice(0, at + NODE_MODULES.length) + name }
}

const authorName = (author) => (typeof author === 'string' ? author.replace(/\s*[<(].*$/, '') : author?.name) || null

const repositoryUrl = (repository) => {
  const url = typeof repository === 'string' ? repository : repository?.url
  if (!url) return null
  return url.replace(/^git\+/, '').replace(/^github:/, 'https://github.com/').replace(/\.git$/, '')
}

/**
 * A package's name, version, licence and the text of its licence: its own licence file, or where it ships none, the
 * standard text of the licence its package.json names, with its author as the copyright holder (standard: true)
 */
export function packageLicence(root) {
  const meta = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const license = typeof meta.license === 'string' ? meta.license : meta.license?.type ?? null
  const file = readdirSync(root).find((name) => LICENCE_FILE.test(name))
  const holder = authorName(meta.author)
  let text = file ? readFileSync(join(root, file), 'utf8').trim() : null
  const standard = !text && Boolean(STANDARD_TEXTS[license] && holder)
  if (standard) text = STANDARD_TEXTS[license](holder)
  return {
    name: meta.name, version: meta.version, license, text, standard,
    homepage: meta.homepage ?? repositoryUrl(meta.repository)
  }
}

/** licenses.txt: what it is, then each package with its licence's text */
export function licencesText(product, packages) {
  const rule = '='.repeat(100)
  const lines = [
    `Third-party software in ${product}`,
    '',
    `${product[0].toUpperCase()}${product.slice(1)} is distributed under the BSD 3-Clause License.`,
    'It includes the following software, each under its own licence, given in full below.',
    ''
  ]
  for (const p of packages) {
    lines.push(rule, `${p.name} ${p.version}: ${p.license ?? 'licence not stated'}`)
    if (p.homepage) lines.push(p.homepage)
    lines.push(rule, '')
    if (p.standard) {
      lines.push('This package ships no licence file: the standard text of the licence it states, with its author as the',
        'copyright holder.', '')
    }
    lines.push(p.text ?? 'This package ships no licence file: see its licence at its home page.', '')
  }
  return lines.join('\n')
}

/** The Vite plugin, writing licenses.txt for product into the build */
export default function thirdPartyLicences(product) {
  return {
    name: 'third-party-licences',
    generateBundle(_, bundle) {
      const roots = new Set()
      for (const output of Object.values(bundle)) {
        for (const id of Object.keys(output.modules ?? {})) {
          const found = modulePackage(id)
          if (found) roots.add(found.root)
        }
      }
      const packages = [...roots].map(packageLicence).sort((a, b) => a.name.localeCompare(b.name))
      for (const p of packages.filter((p) => !p.text)) {
        this.warn(`${p.name} ${p.version} ships no licence file, and its licence (${p.license}) has no standard text here`)
      }
      this.emitFile({ type: 'asset', fileName: LICENSES_FILE, source: licencesText(product, packages) })
    }
  }
}
