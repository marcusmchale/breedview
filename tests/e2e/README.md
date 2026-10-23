# Front-end tests

BreedView has no unit tests yet. What is here are **end-to-end tests**: they drive the real app in a real browser
against a running backend, the way a user would, and check what appears on the page. They were started from the
scripts used to check the people and controls work in October 2026.

## How it works

- `lib/browser.mjs` starts a headless Chrome with a throwaway profile and talks to it over the Chrome DevTools
  protocol. There is no test framework or browser library to install: Node 22 has the WebSocket and test runner built
  in, and Chrome is the only external program. The driver gives a small API: `goto`, `waitFor` (a JS expression), `type`,
  `click`, `clickText`, `text`, `screenshot`, plus `graphql()` to list the GraphQL requests the page made with their
  timings and sizes, and `heapMB()`.
- `lib/app.mjs` knows BreedView: `login`, `logout`, `register`, and the MailHog mailbox. The dev backend is configured
  to send mail to MailHog, so a test can read the invitation or verification email and follow its link, exactly as a
  user would.
- `*.test.mjs` are tests for Node's built-in runner (`node --test`) with `node:assert`. Each file launches its own
  browser in `before` and closes it in `after`.
- `perf/*.mjs` are not tests but measurement scripts: they print timings, request sizes, DOM row counts and heap for
  the pages that matter at the scale of the test database's scale data. Run them before and after a performance change.

Typing into the page uses the native value setter followed by `input` and `change` events, so Vue and FormKit see the
change as they would from a keyboard. Selectors are the app's own classes and input names; when a component changes,
the test that uses it changes too. A native dialog would block the page: the driver accepts every dialog (a confirm is
confirmed) and reports an alert's message among the console errors.

## Prerequisites

1. The backend running (`uvicorn` in breedgraph) against the synthetic test database (below), with its mail settings
   pointed at MailHog (`MAIL_HOST=localhost`, `MAIL_PORT=1025`, `MAIL_USE_TLS=0`, `MAIL_AUTHENTICATED=0`) and
   `VUE_PORT` set to the dev server's port, so emailed links open the app. MailHog itself on 1025/8025.
2. The dev server: `npm run dev`. To test against a backend on another port: `VITE_API_HOST=http://localhost:8001 npm run dev`.
3. Google Chrome installed (`CHROME_BIN` if it is not `google-chrome` on the path).
4. For `recordGroupExtent.test.mjs` and `positionGrouping.test.mjs`, the analysis worker: analyses past validation
   stay queued without it. From
   breedgraph, with its env loaded: `cd src && ../.venv/bin/python -m analysis_worker.main`.
5. Map tiles in the backend's `MAP_TILES_PATH`, for the maps: from breedgraph, with its env loaded,
   `scripts/map_tiles.py --build https://build.protomaps.com/YYYYMMDD.pmtiles --world-maxzoom 6` (about 45 MB; needs
   the `pmtiles` command, see breedgraph's README, Maps).

## The test database

The tests run against a synthetic, public database that breedgraph builds from its read-policy scenario
(`scripts/build_test_database.py --scale`), with a manifest describing it. Restore it from the breedgraph checkout:

```bash
scripts/restore.sh test_databases/test_database.dump   # instance/neo4j_archive/test_databases/test_database.dump (needs sudo)
python scripts/load_state_store.py             # the Redis state, which is not in the dump
cp instance/neo4j_archive/test_databases/test_database_files/* "$FILE_STORAGE_PATH"   # the reference files
```

`lib/fixture.mjs` reads the manifest, `instance/neo4j_archive/test_databases/test_database.manifest.json` in the breedgraph checkout
next to this repository (`E2E_MANIFEST` to read another). It has the accounts, the teams, and every entity of the
scenario by name, with its id, name, controlling team, release and which viewers can read it (`readable_by`), for
Persons how each viewer sees them (`person_views`). The
trees, teams and releases are drawn in the module docstring of breedgraph's
`tests/breedgraph/scenarios/read_policy_scenario.py`. Tests name entities by their scenario name and take names and
expectations from the manifest, so a rebuilt database with other generated names still passes.

The accounts (`loginAs(page, viewer)` in `lib/app.mjs`), all with the password `readpolicy-test-password`:

| Viewer | Username | Access |
|---|---|---|
| `admin` | `readpolicy_admin` | write, read, curate and admin on the organisation `root`; admin and read on `child` below it |
| `writer` | `readpolicy_writer` | read, write and curate on `child`, which controls most of the data |
| `stranger` | `readpolicy_stranger` | everything on `other`, a second organisation |
| `outsider` | `readpolicy_outsider` | registered, in no team; linked to a private Person in `child` |

`E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD` and `E2E_ADMIN_TEAM` (the team offered in the invitation test, by default
the first the admin administers) override the admin. The data at scale (20 fields of 1,000 trees with 4 leaves each,
a study per field with its datasets, the first of them, the perf scripts' default, with 5 datasets of 5,000 records)
belongs to `child` and is private.

Some tests write: the invitation test registers a new account with a unique name and address at `example.com`
(`E2E_MAIL_DOMAIN` to change), which links `person_private` and unlinks it again, the people test adds a Person and erases it (each run leaves an erased record), the
write actions test grants the admin curate access to `child` and removes it
afterwards, the germplasm unit test gives `crop_line` a unit and creates an entry, then puts the unit back and
deletes the entry, and the record references test submits a dataset to the spectra's submission study and deletes its
record in curation (datasets can't be deleted, so each run leaves one there, empty). Two commit ontology versions,
which stay in its history and make every draft there current, those other tests leave included: the ontology
retirement test, two or three each run, as it retires and restores an "E2E retired subject" and "E2E retired trait"
(made by its first run) and a unit it makes and deletes; and the optional links test, once, for the design it makes,
as a study can't be linked to a draft. Restore the dump when a clean state matters. The backend's own pytest suite flushes the database: never run it while these tests rely on it, and restore
the dump afterwards.

## Running

```bash
npm run test:e2e                 # all tests, one file at a time
node --test tests/e2e/invitation.test.mjs
npm run perf:curation            # STUDY and CONCEPT (default: the manifest's perf); PAGE_SIZE, START and END narrow the records
npm run perf:blocks              # FIELD (default: the manifest's perf.field, a field of 5,001 units): its unit graph on the Units page
npm run perf:analysis            # STUDY and CONCEPT (default: the manifest's perf): dataset selection in the analysis editor
npm run perf:programs            # every study panel's dataset summary on the programs page, opened at once
```

Run the test files one at a time (`--test-concurrency=1`, as `npm run test:e2e` does): in parallel, a browser each,
pages can time out. Other settings: `BREEDVIEW_URL` (default `http://localhost:8080`), `MAILHOG_URL` (default
`http://localhost:8025`).

## What is covered

What the API returns to each viewer under the read policy (placeholders, searches, stand-in teams, write attribution,
file downloads) is tested in breedgraph (`tests/breedgraph/e2e/*_read_api.py`). The tests here check what needs a
browser: that the pages render it, which actions they offer, the modals and labels, and flows across pages.

- `smoke.test.mjs`: every routed page renders for a signed-in user without console errors (access control with each
  of its tabs, the profile with its teams, locations, programs with curation), and the dataset submission opens from
  the first study's Datasets section on the programs page.
- `invitation.test.mjs`: invite offering read and write access to a team and a person record (`person_private`), the
  pending invitation describing both, the emailed link, registration with the prefilled read-only email, the team
  offered once with both accesses and the record accepted, verification from the emailed link, login with the
  affiliations (listed with their access on the profile, and badged under Teams in Access control) and the linked
  record, unlinking it again, and refusal of the used link.
- `affiliationRequests.test.mjs`: the outsider requests read access to the organisation from Teams, the first tab of
  Access control; the email to the organisation's admin links to the Affiliation requests tab, which lists the request
  (counted on the tab) for that admin and not for the stranger, who administers another organisation; the admin
  rejects it, approves it when it is made again, and the outsider's profile lists the organisation. The outsider's
  affiliation is removed before and after.
- `hierarchicalSelect.test.mjs`: the studies picker of the analysis editor selects every study at once through
  "By type…", the panel closes on navigation, a selection by type shows as one chip that dissolves into named chips
  when a study is unticked, and ticking a trial selects the studies below it.
- `curationTable.test.mjs`: in the curation table, a record's 🔒 shows its dataset's controller in full (controls and
  writes) to the writer, and a visitor is shown no controllers and none is asked for.
- `curationUnitsFilter.test.mjs`: the units filter of the curation selection lists only units with records, with
  counts, level by level and by subject.
- `outsiderAccess.test.mjs`: what the outsider sees: placeholders for the hidden program and trial above readable
  studies, no write actions, stand-in teams and placeholder controllers in the controller modal (with a link to
  request an affiliation under Teams in Access control), locations joined
  past hidden ones, readable trees under a placeholder for their hidden unit graph root (the Units page), and the
  curation selection, units filter and table with hidden units as placeholders.
- `anonymousAccess.test.mjs`: someone not signed in gets the open pages in the navigation and the privacy notice in
  the footer, is sent to log in from the others (the people page among them), and sees the public programs and units
  without controller badges or write actions, and no one credited or named as a contact; the map's search finds a
  public location by part of its name and opens it, but not a hidden one, and offers no places; no request on the open pages
  fails apart from the sign-in check, and the open pages request nothing from hosts other than the app and the API
  (maps come from the API's `/tiles`, so the test database needs `scripts/map_tiles.py` run for the world file).
- `germplasmAccess.test.mjs`: the germplasm page draws, for each viewer, the entries the manifest says they can read.
- `peopleAccess.test.mjs`: the people page needs an account; it lists the Persons each viewer sees in full or by
  attribution: the full record (teams, when it was recorded, whether an account is linked, even when the account is
  hidden) for read affiliates and the linked user, the attribution for others; the
  outsider's own private Person with its hidden team stood in for; Edit and Erase follow curate and admin access and
  the linked user.
- `accountsAccess.test.mjs`: in the controller modal, writes are attributed to the writer's Person where the viewer
  cannot see the account, or to "an account without a Person record".
- `recordGroupExtent.test.mjs`, on the replicates study (manifest `replicates`), signed in as the writer, who curates
  it: a record group type's optional default extent on its card and in its form; each grouping's extent badge; a new
  grouping's required extent, prefilled from its type's default and not replacing a choice, and the note when an edit
  changes it; curation of `same_time` and `width` sectioned by the shared plate only, with each tree's replicates
  together in code order; times of day shown as given with nothing to save, and each tree's location from its field;
  factor records in their own section first, at all times and levels, and each variable row's applied Light from its
  plot; a grouping with records refused deletion; every analysis outcome in the manifest's `expected.cases`, a failed analysis reopened at its
  replicates field, and the levels of a within-unit-graph grouping named with their field, merged by a shared level.
  It leaves two draft record group types per run, and deletes the groupings it creates. The slowest file: about
  20 analyses.
- `datasetArrivalPicker.test.mjs`, on the arrivals (skipped without them): the dataset submission's units picker at the
  lab lists its arrivals, an arrival's tick selects the units that came, and opening it lists them.
- `recordReferences.test.mjs`, on the spectra (manifest `spectra`; skipped without them), signed in as the writer: the
  files of records on a complex scale, chosen in the references modal. In curation, the modal opens with the cell's
  file selected and listed by its description, a search for the files leaves it out, and the record cites the files
  saved, a second one added and saved, then removed and saved in turn. In the dataset submission, the file chosen is
  selected when the modal opens again, and the submitted record cites it. Curated, that record's only file can't be
  removed: the cell says to delete the record instead, and saved anyway the record is refused and keeps its file; marked
  for deletion it needs none, and it is deleted. The curated record is put back before and after.
- `positionGrouping.test.mjs`, on the positions (manifest `positions`; skipped without them), signed in as the writer:
  the analysis editor's location types, the fields the height records are at with their layouts' axes, results by
  field and by row (each row labelled with its layout) as the manifest's `expected` cases give them with the records
  that can't be placed, and by country a sample analysed abroad in its lab's country, then by its tree in the tree's,
  kept on reopening.
- `unitMoves.test.mjs`, on the arrivals (skipped without them), signed in as the writer: the lab's spare arrival
  moved on to the lab store and found there, ended and its start corrected (the page following it), and one of its
  units received back at the lab from the store through the units picker. Their positions are put back afterwards.
- `unitsPage.test.mjs`, on the arrivals (manifest `arrivals`; skipped without them): the lab's arrivals newest first as
  the writer and the outsider see them, a tree's samples elsewhere as links from its field to the arrivals that have
  them, a sample taken at the lab below its sample, the moved-on, used-up and visiting units marked, the hidden sample's
  extract in its place for the outsider, the germplasm the samples inherit as the writer and the outsider see it (and
  the card's link to where it comes from), germplasm given to a sample coming down to its extract in place (removed
  afterwards), the Locations page's link to a location's units, and a child added with its parent listed below it
  (deleted afterwards).
- `writeActions.test.mjs`: write actions follow the backend's checks (`composables/controls/useWriteAccess.js`):
  creating needs a write affiliation, changing or adding to a program needs curate access to a team controlling it.
  The admin can edit the organisation's program but not the child team's, until the test grants it curate access to
  `child`; the grant is removed afterwards.
- `bulkControl.test.mjs`, as the admin: the Bulk control counts by kind and release as the API gives them; a scale
  study dataset's release set and set back; the unit tree opened past a root another team controls to the unit the
  child team does; a scale tree and its units set to a release and back; a tree's control shared with the root team,
  which renounces it. Every change is reverted, leaving Control history.

## Adding a test

Copy the shape of `invitation.test.mjs`: launch a browser in `before`, use the helpers, assert on what the page shows,
close in `after`. Keep each test file independent of the others, and make the data it creates unique per run with
`uniqueName`. For flows that need an email, use `waitForMail(address, subjectFragment, { after })` with the time the
test started, so an older message for the same address is not mistaken for the new one.

## What is not here

Unit tests for composables and components would use Vitest with Vue Test Utils; nothing of that kind exists yet, and
the e2e tests above are not a substitute for it. They are slow (a minute or more each), need the whole stack running,
and tell you that a flow broke, not where.
