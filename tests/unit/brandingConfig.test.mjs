// A deployment's branding.json, as the app applies it (src/branding/brandingConfig.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandingFrom } from '../../src/branding/brandingConfig.js'

// CSS.supports('color', value), as far as these tests need it
const supports = (property, value) => property === 'color' && /^(#[0-9a-f]{3,8}|rgb\(.*\)|[a-z]+)$/i.test(value)
const read = (config) => brandingFrom(config, { folder: '/branding/', supports })

test('without a branding the app keeps its own look', () => {
  assert.deepEqual(read({}), { variables: {}, logos: [], footer: { text: null, links: [] }, favicon: null, stylesheet: null, problems: [] })
  assert.deepEqual(read([]).problems, ['branding.json is not an object'])
})

test("a brand's colours set the variables, and the shades it doesn't give are worked out", () => {
  const { variables, problems } = read({ colors: { header: '#7d1d3f', primary: '#00548c', accent: 'rgb(0, 114, 188)', accentLight: '#e6f1f8' } })
  assert.deepEqual(variables, {
    '--brand-header': '#7d1d3f',
    '--brand-primary': '#00548c',
    '--brand-accent': 'rgb(0, 114, 188)',
    '--brand-accent-light': '#e6f1f8',
    '--brand-primary-dark': 'color-mix(in srgb, #00548c 75%, black)',
    '--brand-link': '#00548c',
    '--brand-accent-dark': 'color-mix(in srgb, rgb(0, 114, 188) 85%, black)',
    '--brand-accent-darker': 'color-mix(in srgb, rgb(0, 114, 188) 70%, black)',
    '--brand-analysis-accent': 'color-mix(in srgb, rgb(0, 114, 188) 85%, black)',
    '--brand-analysis-accent-soft': '#e6f1f8'
  })
  assert.deepEqual(problems, [])
  assert.deepEqual(read({ colors: { header: 'red; background: url(x)', banner: '#fff' } }).problems, [
    'colors.header "red; background: url(x)" is not a colour',
    'colors.banner is not one of header, headerText, primary, primaryDark, accent, accentDark, accentDarker, accentLight, link, footer, footerText'
  ])
})

test('its files are in the branding folder, as the app contacts no third party; its links may go anywhere', () => {
  const brand = read({
    logos: [
      { src: 'logos/university.svg', alt: 'University of Example', href: 'https://www.example.edu', height: 500 },
      { src: 'https://cdn.example.com/logo.png', alt: 'Elsewhere' },
      { src: '../secret.png' }
    ],
    favicon: 'favicon.ico',
    font: { family: '"Open Sans", Arial, sans-serif', stylesheet: 'fonts/fonts.css' },
    footer: {
      text: 'BreedGraph is run by the University of Example.',
      links: [
        { label: 'University of Example', href: 'https://www.example.edu' },
        { label: 'Accessibility', href: 'javascript:alert(1)' },
        { label: 'Contact', href: 'mailto:breedgraph@example.edu' }
      ]
    }
  })
  assert.deepEqual(brand.logos, [{ src: '/branding/logos/university.svg', alt: 'University of Example', href: 'https://www.example.edu', height: 120 }])
  assert.equal(brand.favicon, '/branding/favicon.ico')
  assert.equal(brand.stylesheet, '/branding/fonts/fonts.css')
  assert.equal(brand.variables['--brand-font'], '"Open Sans", Arial, sans-serif')
  assert.deepEqual(brand.footer, {
    text: 'BreedGraph is run by the University of Example.',
    links: [{ label: 'University of Example', href: 'https://www.example.edu' }, { label: 'Contact', href: 'mailto:breedgraph@example.edu' }]
  })
  assert.deepEqual(brand.problems, [
    'logos[1].src "https://cdn.example.com/logo.png" is not a file in the branding folder',
    'logos[2].src "../secret.png" is not a file in the branding folder',
    'footer.links[1].href "javascript:alert(1)" is not a web or email address'
  ])
})
