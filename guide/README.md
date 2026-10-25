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
  worker), finding the trial and study in `guide/data/this-season.mjs`.

To record a later chapter of a chain alone, load the dump, play the chapters before it with `--fast`, then record it.
A storyboard checks that it starts from the state it expects.

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
  chapter takes, and for a graph, a node dragged to the clearest spot near it (`clearOf`) and its linked nodes brought
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
since it shows no data. `src/guide/chapters.js` puts the chapters in parts, and in the collections that are printed
together; a chapter not yet written is left out. A chapter's markdown is rendered by `src/composables/system/markdown.js`
with the guide's options (`src/guide/renderGuide.js`):
- a picture is the bare file name of one in `public/guide-media/`, and the video is written as a picture of
  `<chapter>.mp4`;
- links may go to paths within the app, such as `/guide/joining`;
- `> [!WHO]`, `> [!SEES]`, `> [!DATA]` and `> [!NOTE]` open callouts, and pipe tables are tables.

Under the video, a bar shows the lead of the step playing, and each step's Play button plays the video from it.

```bash
npm run guide:pdf -- --site https://<the demonstration site>   # print /guide/print/dpo from guide:serve
npm run build:demo                                              # the demonstration site, with its banner
```

`guide:pdf` writes `public/guide-media/guide-<collection>.pdf` (`--collection`, `dpo` by default), with each video's
poster and a link to it under `--site`. `build:demo` builds with `.env.demo`, whose banner says the site is fictional
and may be reset; the demonstration API's address goes in `.env.demo.local`.
