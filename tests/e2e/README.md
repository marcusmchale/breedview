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
  the pages that matter at dev data scale. Run them before and after a performance change.

Typing into the page uses the native value setter followed by `input` and `change` events, so Vue and FormKit see the
change as they would from a keyboard. Selectors are the app's own classes and input names; when a component changes,
the test that uses it changes too.

## Prerequisites

1. The backend running (`uvicorn` in breedgraph) with its mail settings pointed at MailHog
   (`MAIL_HOST=localhost`, `MAIL_PORT=1025`, `MAIL_USE_TLS=0`, `MAIL_AUTHENTICATED=0`) and `VUE_PORT` set to the
   dev server's port, so emailed links open the app. MailHog itself on 1025/8025.
2. The dev server: `npm run dev`. To test against a backend on another port: `VITE_API_HOST=http://localhost:8001 npm run dev`.
3. Google Chrome installed (`CHROME_BIN` if it is not `google-chrome` on the path).
4. An existing account to act as, verified, and an admin of at least one team. Defaults are `tester1` /
   `TestPass123!`; override with `E2E_ADMIN_USER`, `E2E_ADMIN_PASSWORD`, and `E2E_ADMIN_TEAM` to name the team offered
   in the invitation test.

The tests are **additive**: each run registers a new account with a unique name and address at `example.com`
(`E2E_MAIL_DOMAIN` to change), and leaves it in the database. They do not flush anything. Note that the backend's own
pytest suite does flush the database, so never run it against a database you want to keep.

## Running

```bash
npm run test:e2e                 # all tests
node --test tests/e2e/invitation.test.mjs
npm run e2e:partial              # create the partial access account and release its entities; `-- restore` makes them private again
npm run perf:curation            # STUDY="Study B" CONCEPT="Variable A" by default; PAGE_SIZE, START and END narrow the records
npm run perf:blocks              # FIELD="Field B" by default
npm run perf:analysis            # STUDY="Study B" CONCEPT="Variable A" by default: dataset selection in the analysis editor
npm run perf:programs            # every study panel's dataset summary on the programs page, opened at once
```

Other settings: `BREEDVIEW_URL` (default `http://localhost:8080`), `MAILHOG_URL` (default `http://localhost:8025`).

## What is covered

- `smoke.test.mjs`: every routed page renders for a signed-in user without console errors.
- `invitation.test.mjs`: invite with a team offer, the emailed link, registration with the prefilled read-only email
  and the accepted team, verification from the emailed link, login with the affiliation, and refusal of the used link.
- `hierarchicalSelect.test.mjs`: the studies picker of the analysis editor selects every study at once through
  "By type…", the panel closes on navigation, a selection by type shows as one chip that dissolves into named chips
  when a study is unticked, and ticking a trial selects the studies below it.

- `partialAccess.test.mjs`: what a registered user outside every team sees. `lib/partialAccess.mjs` keeps an account,
  `partial1` / `TestPass123!` (`E2E_PARTIAL_USER` to change), invited by the admin with no team offered, and releases a
  few dev data migration entities to registered users with hidden ones between them: the Study A study under its
  hidden trial and program, one of its datasets, field Field A and one tree in its hidden block, and location Field A under
  two hidden regions. The ids are those of the dev database restored from `migration.dump`. The tests check
  that hidden entities are skipped or shown as placeholders on the programs, regions, blocks and curation pages. The
  account and the releases are left in place for checking by hand; `npm run e2e:partial -- restore` makes the entities
  private again.

- `writeActions.test.mjs`: write actions follow the backend's checks (`composables/controls/useWriteAccess.js`):
  creating needs a write affiliation, changing or adding to an entity needs curate access to a team controlling it.
  The admin account sees "Create New Program" but no program edits until the test grants it curate access to the
  migration team (`E2E_CURATE_TEAM`, default 2); the grant is removed afterwards.

- `anonymousAccess.test.mjs`: someone not signed in can open the programs, regions, arrangements, blocks and
  datasets pages and sees what is public there, with placeholders, no controller badges and no write actions;
  other pages send them to log in. No request on those pages fails apart from the sign-in check, and the ontology
  is readable in its published and referential views but not the editorial one. The public entities come from `lib/partialAccess.mjs`, which releases the
  Study A study, its dataset 6, field Field A and location Field A to the public and the Variety A tree to registered users.

## Adding a test

Copy the shape of `invitation.test.mjs`: launch a browser in `before`, use the helpers, assert on what the page shows,
close in `after`. Keep each test file independent of the others, and make the data it creates unique per run with
`uniqueName`. For flows that need an email, use `waitForMail(address, subjectFragment, { after })` with the time the
test started, so an older message for the same address is not mistaken for the new one.

## What is not here

Unit tests for composables and components would use Vitest with Vue Test Utils; nothing of that kind exists yet, and
the e2e tests above are not a substitute for it. They are slow (a minute or more each), need the whole stack running,
and tell you that a flow broke, not where.
