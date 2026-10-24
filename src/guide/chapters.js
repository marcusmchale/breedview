// The user guide's parts and chapters in reading order, and the collections printed together (/guide/print/<name>).
// A chapter is src/guide/chapters/<slug>.md; one not yet written is left out.
import { renderGuide } from './renderGuide'

const sources = import.meta.glob('./chapters/*.md', { query: '?raw', import: 'default', eager: true })
const written = Object.fromEntries(Object.entries(sources).map(([path, text]) => [path.replace(/^.*\/(.*)\.md$/, '$1'), text]))

export const PARTS = [
  { title: 'Getting started', chapters: ['looking-around', 'exploring-data', 'joining', 'teams'] },
  { title: "Running this season's trial", chapters: ['setting-up', 'recording', 'checking', 'analysing'] },
  { title: 'Sharing and people', chapters: ['sharing', 'people', 'your-data'] },
  { title: 'Preparing next season', chapters: ['describing', 'places', 'plant-material', 'planting'] },
  { title: 'Further topics', chapters: ['samples', 'handing-over', 'looking-after-the-ontology', 'data-files'] }
]

export const COLLECTIONS = {
  // every place personal data is collected, shown or removed, and what is public
  dpo: {
    title: 'BreedGraph for data protection and legal review',
    chapters: ['looking-around', 'joining', 'teams', 'sharing', 'people', 'your-data']
  }
}

const rendered = {}
/** A written chapter as its page shows it (renderGuide), or null */
export const chapter = (slug) => {
  if (!written[slug]) return null
  rendered[slug] ??= { slug, ...renderGuide(written[slug]) }
  return rendered[slug]
}

/** The parts with their written chapters, in order: [{ title, chapters: [chapter] }] */
export const contents = () => PARTS
  .map((part) => ({ title: part.title, chapters: part.chapters.map(chapter).filter(Boolean) }))
  .filter((part) => part.chapters.length > 0)

/** The written chapters in reading order, for the links to the previous and next */
export const readingOrder = () => contents().flatMap((part) => part.chapters)
