// The licences file a build writes of the third-party code it bundles (scripts/thirdPartyLicences.js), from packages
// in a made-up node_modules
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { modulePackage, packageLicence, licencesText } from '../../scripts/thirdPartyLicences.js'

function nodeModules(packages) {
  const root = join(mkdtempSync(join(tmpdir(), 'licences-')), 'node_modules')
  for (const [name, meta, files = {}] of packages) {
    mkdirSync(join(root, name), { recursive: true })
    writeFileSync(join(root, name, 'package.json'), JSON.stringify({ name, ...meta }))
    for (const [file, text] of Object.entries(files)) writeFileSync(join(root, name, file), text)
  }
  return root
}

test("a bundled module is its package's, by the last node_modules in its path", () => {
  assert.deepEqual(modulePackage('/app/node_modules/leaflet/dist/leaflet-src.js'),
    { name: 'leaflet', root: '/app/node_modules/leaflet' })
  assert.deepEqual(modulePackage('\0/app/node_modules/@vue/shared/dist/shared.js?commonjs-proxy'),
    { name: '@vue/shared', root: '/app/node_modules/@vue/shared' })
  assert.deepEqual(modulePackage('/app/node_modules/a/node_modules/b/index.js'),
    { name: 'b', root: '/app/node_modules/a/node_modules/b' })
  assert.equal(modulePackage('/app/src/main.js'), null, "the project's own")
})

test("a package's licence is its own file, or the standard text with its author", () => {
  const root = nodeModules([
    ['leaflet', { version: '1.9.4', license: 'BSD-2-Clause' }, { 'LICENSE': 'BSD 2-Clause License\n\nCopyright (c) Leaflet\n' }],
    ['pmtiles', { version: '4.3.0', license: 'BSD-3-Clause', author: 'Brandon Liu' }],
    ['extract-files', { version: '13.0.0', license: 'MIT', author: { name: 'Jayden Seric' }, repository: 'github:jaydenseric/extract-files' }],
    ['@wry/trie', { version: '0.5.0', license: 'MIT', author: 'Ben Newman <ben@eloper.dev>' }],
    ['odd', { version: '1.0.0', license: 'Unlicense' }]
  ])
  const leaflet = packageLicence(join(root, 'leaflet'))
  assert.deepEqual([leaflet.license, leaflet.text, leaflet.standard], ['BSD-2-Clause', 'BSD 2-Clause License\n\nCopyright (c) Leaflet', false])
  const pmtiles = packageLicence(join(root, 'pmtiles'))
  assert.ok(pmtiles.standard && pmtiles.text.startsWith('BSD 3-Clause License\n\nCopyright (c) Brandon Liu\n'))
  const extractFiles = packageLicence(join(root, 'extract-files'))
  assert.ok(extractFiles.text.includes('Copyright (c) Jayden Seric\n'))
  assert.equal(extractFiles.homepage, 'https://github.com/jaydenseric/extract-files')
  assert.ok(packageLicence(join(root, '@wry/trie')).text.includes('Copyright (c) Ben Newman\n'), 'without the address')
  assert.equal(packageLicence(join(root, 'odd')).text, null, 'no standard text of a licence it has none for')
})

test('the licences file gives each package, its licence and its text', () => {
  const text = licencesText('BreedView', [
    { name: 'leaflet', version: '1.9.4', license: 'BSD-2-Clause', text: 'BSD 2-Clause License', standard: false, homepage: 'https://leafletjs.com' },
    { name: 'pmtiles', version: '4.3.0', license: 'BSD-3-Clause', text: 'BSD 3-Clause License', standard: true, homepage: null }
  ])
  assert.ok(text.startsWith('Third-party software in BreedView\n'))
  assert.ok(text.includes('leaflet 1.9.4: BSD-2-Clause\nhttps://leafletjs.com\n'))
  assert.ok(text.includes('This package ships no licence file: the standard text of the licence it states'))
})
