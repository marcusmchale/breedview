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
the test that uses it changes too.

## Prerequisites

1. The backend running (`uvicorn` in breedgraph) against the synthetic test database (below), with its mail settings
   pointed at MailHog (`MAIL_HOST=localhost`, `MAIL_PORT=1025`, `MAIL_USE_TLS=0`, `MAIL_AUTHENTICATED=0`) and
   `VUE_PORT` set to the dev server's port, so emailed links open the app. MailHog itself on 1025/8025.
2. The dev server: `npm run dev`. To test against a backend on another port: `VITE_API_HOST=http://localhost:8001 npm run dev`.
3. Google Chrome installed (`CHROME_BIN` if it is not `google-chrome` on the path).

## The test database

The tests run against a synthetic, public database that breedgraph builds from its read-policy scenario
(`scripts/build_test_database.py --scale`), with a manifest describing it. Restore it from the breedgraph checkout:

```bash
scripts/restore.sh test_database.dump          # instance/neo4j_archive/test_database.dump (needs sudo)
python scripts/load_state_store.py             # the Redis state, which is not in the dump
cp instance/neo4j_archive/test_database_files/* "$FILE_STORAGE_PATH"   # the reference files
```

`lib/fixture.mjs` reads the manifest, `instance/neo4j_archive/test_database.manifest.json` in the breedgraph checkout
next to this repository (`E2E_MANIFEST` to read another). It has the accounts, the teams, and every entity of the
scenario by name, with its id, name, controlling team, release and which viewers can read it (`readable_by`). The
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
(`E2E_MAIL_DOMAIN` to change), and the write actions test grants the admin curate access to `child` and removes it
afterwards. Restore the dump when a clean state matters. The backend's own pytest suite flushes the database: never
run it while these tests rely on it, and restore the dump afterwards.

## Running

```bash
npm run test:e2e                 # all tests, one file at a time
node --test tests/e2e/invitation.test.mjs
npm run perf:curation            # STUDY and CONCEPT (default: the manifest's perf); PAGE_SIZE, START and END narrow the records
npm run perf:blocks              # FIELD (default: the manifest's perf.field, a field of 5,001 units)
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

- `smoke.test.mjs`: every routed page renders for a signed-in user without console errors, and the dataset
  submission opens for the first study.
- `invitation.test.mjs`: invite with a team offer, the emailed link, registration with the prefilled read-only email
  and the accepted team, verification from the emailed link, login with the affiliation, and refusal of the used link.
- `hierarchicalSelect.test.mjs`: the studies picker of the analysis editor selects every study at once through
  "By type…", the panel closes on navigation, a selection by type shows as one chip that dissolves into named chips
  when a study is unticked, and ticking a trial selects the studies below it.
- `curationUnitsFilter.test.mjs`: the units filter of the curation selection lists only units with records, with
  counts, level by level and by subject.
- `outsiderAccess.test.mjs`: what the outsider sees: placeholders for the hidden program and trial above readable
  studies, no write actions, stand-in teams and placeholder controllers in the controller modal, regions joined past
  hidden locations, readable trees under a placeholder for their hidden block root, and the curation selection,
  units filter and table with hidden units as placeholders.
- `anonymousAccess.test.mjs`: someone not signed in gets the open pages in the navigation, is sent to log in from
  the others, and sees the public programs and blocks without controller badges or write actions; no request on the
  open pages fails apart from the sign-in check.
- `germplasmAccess.test.mjs`: the germplasm page draws, for each viewer, the entries the manifest says they can read.
- `peopleAccess.test.mjs`: the people page lists the Persons each viewer can read, and the outsider their own private
  Person with its hidden team stood in for; Edit and Erase follow curate and admin access and the linked user.
- `accountsAccess.test.mjs`: in the controller modal, writes are attributed to the writer's Person where the viewer
  cannot see the account, or to "an account without a Person record".
- `writeActions.test.mjs`: write actions follow the backend's checks (`composables/controls/useWriteAccess.js`):
  creating needs a write affiliation, changing or adding to a program needs curate access to a team controlling it.
  The admin can edit the organisation's program but not the child team's, until the test grants it curate access to
  `child`; the grant is removed afterwards.

## Adding a test

Copy the shape of `invitation.test.mjs`: launch a browser in `before`, use the helpers, assert on what the page shows,
close in `after`. Keep each test file independent of the others, and make the data it creates unique per run with
`uniqueName`. For flows that need an email, use `waitForMail(address, subjectFragment, { after })` with the time the
test started, so an older message for the same address is not mistaken for the new one.

## What is not here

Unit tests for composables and components would use Vitest with Vue Test Utils; nothing of that kind exists yet, and
the e2e tests above are not a substitute for it. They are slow (a minute or more each), need the whole stack running,
and tell you that a flow broke, not where.
