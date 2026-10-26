# Recording the guide

The user guide's chapters are in `src/guide/chapters/`. Each chapter's video is recorded from a storyboard in
`guide/storyboards/`, played in a headless Chrome against the demonstration database (breedgraph
`docs/demo-database.md`). The captions are the bold leads of the chapter's `## Steps`, matched to the storyboard by
their `{#step-id}`.

## The recording stack

Record against a stack of its own, never the development API on port 8000:

1. Load the demonstration dump into throwaway services (from breedgraph, with the instance environment loaded):
   `SCRATCH=<dir> scripts/scratch_services.sh load instance/neo4j_archive/demo_databases/demo_database.dump
   instance/neo4j_archive/demo_databases/demo_database_files`.
2. Start an API on port 8001 with that stack's environment: `eval "$(SCRATCH=<dir> scripts/scratch_services.sh env)"`,
   then `HOST_PORT=8001 VUE_PORT=8081 .venv/bin/uvicorn src.breedgraph.main:app --port 8001`.
3. Start an analysis worker polling it (`API_URL=http://localhost:8001`) for the chapters that analyse data.
4. Have MailHog running for the chapters that send email.
5. Serve a production build of BreedView on port 8081: `npm run guide:serve`. The dev server's cold loads show blank
   frames for seconds.

Load the dump again before each chapter that changes data, and stop the API while it loads. Chapters that build on
each other are a chain, recorded in order on one load:
- joining, Nina's: `joining`, `teams`, then `your-data`, sharing what they enter beside the manifest in
  `guide/data/joining.mjs`;
- this season, the 2026 trial: `setting-up`, `recording`, `checking`, then `analysing` (which needs the analysis
  worker), finding the trial and study in `guide/data/this-season.mjs`;
- next season, the 2027 trial in Hill Field: `describing`, `places`, `plant-material`, then `planting`, finding what
  each made in `guide/data/next-season.mjs`, which also plans the 2027 plots.

The other chapters (`looking-around`, `exploring-data`, `sharing`, `people`, `samples`, `handing-over`,
`looking-after-the-ontology` and `data-files`) each start from a fresh load. To record a later chapter of a chain alone,
load the dump, play the chapters before it with `--fast`, then record it. A storyboard checks that it starts from the
state it expects.

`--app` and `--api` play a storyboard against another stack, such as a second scratch stack with the dump loaded and a
dev server pointed at its API, to try a storyboard with `--fast` while the recording stack records.

## Commands

```bash
npm run guide:doctor             # what the recordings need: ffmpeg, fonts, the stack, MailHog, the map region
npm run guide:check              # play every storyboard without recording, as a check that it still runs
npm run guide:record             # record and encode every chapter (--only <chapter> for one)
npm run guide:encode             # encode the saved recordings again, e.g. after rewording a caption
```

Recordings are saved in `guide/out/<chapter>/` (frames and `timeline.json`). The media go to `public/guide-media/`
(`<chapter>.mp4`, `.vtt` and `.jpg`), which git ignores: they are archived with each guide release.

## How it works

- **Frames:** Chrome runs with a 1280x800 page at a scale of 1.5, so its screencast frames are 1920x1200. Chrome sends
  a frame only when the page changes, so each frame lasts until the next.
- **Input** (`lib/input.mjs`): the mouse moves along eased paths and presses and releases, drags (a graph's node is
  grabbed where it is, as its layout settles), and keys are typed one at a time. Each target is checked first: there,
  in view, visible, enabled, still and not covered. One under a bar that stays put as the page scrolls, such as the
  navigation bar or a sticky submit bar, is scrolled out from under it.
- **Storyboards** share `lib/storyboard.mjs`: elements found by their text, the ways into pages that more than one
  chapter takes (the location tree, a tree picker's levels), and for a graph, a node dragged to the clearest spot near it (`clearOf`) and its linked nodes brought
  beside it, so that each link and its label stand clear (`gatherLinked`).
- **Overlay** (`lib/overlay.js`): the cursor and its clicks, and stand-ins for what headless frames don't show: a
  select's menu, confirm dialogs, key presses, tooltips, and cards for the clipboard, emails, files chosen and files
  downloaded (the first lines of a CSV the page makes). It also turns spell checking off, whose marks would follow the
  recording browser's language.
- **Cuts** (`lib/recorder.mjs`): page loads and work done off camera are cut from the video. After off-camera work, a
  chip says what was done, such as "Later: 35 more plots".
- **Encoding** (`lib/encode.mjs`): an H.264 MP4 at 30 fps (BT.709, faststart), WebVTT captions with one cue a step,
  and a poster: the frame a storyboard marks with `recorder.poster()`, or else the second step's opening.

## The guide's pages and its PDF

The app shows the guide at `/guide` (`src/components/guide/`). It is open to everyone, before the Terms of Use too,
since it shows no data. `src/guide/chapters.js` puts the chapters in parts, and in the collections printed as documents
of their own; a chapter not yet written is left out. A chapter's markdown is rendered by `src/composables/system/markdown.js`
with the guide's options (`src/guide/renderGuide.js`):
- a picture is the bare file name of one in `public/guide-media/`, and the video is written as a picture of
  `<chapter>.mp4`;
- links may go to paths within the app, such as `/guide/joining`;
- `> [!WHO]`, `> [!SEES]`, `> [!DATA]` and `> [!NOTE]` open callouts, and pipe tables are tables.

Under the video, a bar shows the lead of the step playing, and each step's Play button plays the video from it.

```bash
npm run guide:pdf -- --site https://breedgraph.universityofgalway.ie/demo   # print /guide/print/dpo from guide:serve
npm run build:demo                                                          # the demonstration site, with its banner
```

`guide:pdf` writes `guide/out/guide-<collection>.pdf` (`--collection`, `dpo` by default; `--out` for another file), a
document to hand out apart from the guide, with each video's poster and a link to it under `--site`. The page it prints,
`/guide/print/<collection>`, is in the dev server and guide:serve's build only (`VITE_GUIDE_PRINT`): no site offers it,
and the guide's contents don't list it. `build:demo` builds with `.env.demo`, whose banner says the site is fictional
and may be reset, for `/demo/` (`VITE_BASE_PATH`), where the site is served on production's host; the router, the
guide's media and its links follow the base path. It writes `dist-demo/`, leaving production's `dist/` as it is. The
demonstration API's address, `https://breedgraph.universityofgalway.ie/demo`, goes in `.env.demo.local`.

## The guide on GitHub Pages

The guide is also a static site of its own, at https://marcusmchale.github.io/breedview/guide/, for anyone to read
without a BreedGraph to hand: the app's guide pages (`src/components/guide`), with no API, sign-in or Terms of Use, in
a shell of their own (`src/guideSite`, `guide-site/index.html`) that links to the demonstration site and to the two
repositories. `vite.guide.config.js` builds it into `dist-guide`, with `.env.guide`'s base path (`/breedview/`) and
demonstration site, and writes each chapter a copy of the page, with its title and description, at
`guide/<chapter>/index.html`, as Pages has no fallback to a single page app (and a `404.html` for any other path).

The videos are too large to keep in git (over 100 MB, and a new copy with each recording), so they are attached to a
GitHub release instead, as `guide-media.zip`, and the workflow `.github/workflows/guide-pages.yml` builds the site with
those of the most recent release that has them, and deploys it. It runs when a release is published, and by hand.

To publish the guide, once the videos are recorded and encoded into `public/guide-media`:

```bash
npm run guide:media-zip     # public/guide-media as guide/out/guide-media.zip
gh release create guide-2026-10-26 guide/out/guide-media.zip --title "User guide, 2026-10-26" \
  --notes "The user guide's videos, for its GitHub Pages site"
```

The release starts the workflow (Actions → User guide on GitHub Pages; it can be run from there too), which builds
the guide from the default branch as it then stands: a release runs on its tag, which the github-pages environment
doesn't let deploy, so it starts the workflow again on the default branch. Once only, before the first: Settings →
Pages → Source: GitHub Actions.

To check the site before publishing it: `npm run guide:site`, then `npm run guide:site:preview` and open
http://localhost:8086/breedview/guide (the preview falls back to the page for any path, as Pages doesn't, so check a
chapter's own address too).
