// The markdown renderer (src/composables/system/markdown.js): without options, as the Terms of Use, the privacy notice
// and licences have always been rendered; with the guide's options, what each adds, and that nothing unsafe gets through
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '../../src/composables/system/markdown.js'
import { GUIDE_OPTIONS } from '../../src/guide/renderGuide.js'

const legal = `# Terms of Use

You accept these **Terms** when you use *BreedGraph*.
Read the [privacy notice](https://example.org/privacy) or write to [us](mailto:office@example.org).

- One item
  that continues
- Two

1. First
2. Second

---
<script>alert(1)</script> and [a link](javascript:alert(1)) stay as text.
> A quote stays a paragraph, | as do | pipes |, ![an image](shot.png) and \`code\`.`

test('without options, the output is as it always was', () => {
  assert.equal(renderMarkdown(legal), [
    '<h1>Terms of Use</h1>',
    '<p>You accept these <strong>Terms</strong> when you use <em>BreedGraph</em>. Read the ' +
      '<a href="https://example.org/privacy" target="_blank" rel="noopener noreferrer">privacy notice</a> or write to ' +
      '<a href="mailto:office@example.org" target="_blank" rel="noopener noreferrer">us</a>.</p>',
    '<ul><li>One item that continues</li><li>Two</li></ul>',
    '<ol><li>First</li><li>Second</li></ol>',
    '<hr>',
    '<p>&lt;script&gt;alert(1)&lt;/script&gt; and [a link](javascript:alert(1)) stay as text. &gt; A quote stays a ' +
      'paragraph, | as do | pipes |, ![an image](shot.png) and `code`.</p>'
  ].join('\n'))
})

test("the guide's pictures are bare file names of its media; any other image stays as written", () => {
  assert.equal(renderMarkdown('![The map](locations-map.png)', GUIDE_OPTIONS),
    '<p><img src="/guide-media/locations-map.png" alt="The map"></p>')
  for (const address of ['../secret.png', '/etc/passwd.png', 'https://example.org/x.png', 'javascript:alert(1)', 'x.svg']) {
    assert.ok(!renderMarkdown(`![x](${address})`, GUIDE_OPTIONS).includes('<img'), address)
  }
  assert.equal(renderMarkdown('![" onerror="alert(1)](x.png)', GUIDE_OPTIONS),
    '<p><img src="/guide-media/x.png" alt="&quot; onerror=&quot;alert(1)"></p>')
})

test('links within the app open in the same tab; other addresses stay as written', () => {
  assert.equal(renderMarkdown('[Joining](/guide/joining#steps)', GUIDE_OPTIONS), '<p><a href="/guide/joining#steps">Joining</a></p>')
  for (const address of ['//example.org/x', 'javascript:alert(1)', 'guide/joining', '/guide/<x>']) {
    assert.ok(!renderMarkdown(`[x](${address})`, GUIDE_OPTIONS).includes('<a '), address)
  }
})

test('a link within the app that the internalLinks function refuses shows as its text alone', () => {
  const options = { ...GUIDE_OPTIONS, internalLinks: (address) => address !== '/guide/planting' }
  assert.equal(renderMarkdown('As [Planting a trial](/guide/planting) shows.', options), '<p>As Planting a trial shows.</p>')
  assert.equal(renderMarkdown('[Joining](/guide/joining)', options), '<p><a href="/guide/joining">Joining</a></p>')
  assert.equal(renderMarkdown('[<b>x</b>](/guide/planting)', options), '<p>&lt;b&gt;x&lt;/b&gt;</p>', 'its text escaped')
})

test('pipe tables become tables, their cells escaped', () => {
  assert.equal(renderMarkdown('| Who | Sees |\n|---|---|\n| A visitor | **public** <b>data</b> |', GUIDE_OPTIONS),
    '<table><thead><tr><th>Who</th><th>Sees</th></tr></thead>' +
      '<tbody><tr><td>A visitor</td><td><strong>public</strong> &lt;b&gt;data&lt;/b&gt;</td></tr></tbody></table>')
})

test('callouts of the names allowed become asides; any other quote is a blockquote, escaped', () => {
  assert.equal(renderMarkdown('> [!WHO]\n> Anyone, **without** an account.', GUIDE_OPTIONS),
    '<aside class="callout callout-who"><p>Anyone, <strong>without</strong> an account.</p></aside>')
  assert.equal(renderMarkdown('> [!SCRIPT]\n> <script>x</script>', GUIDE_OPTIONS),
    '<blockquote><p>[!SCRIPT] &lt;script&gt;x&lt;/script&gt;</p></blockquote>')
  assert.equal(renderMarkdown('Use `npm run guide:record`.', GUIDE_OPTIONS), '<p>Use <code>npm run guide:record</code>.</p>')
})
