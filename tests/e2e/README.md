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
npm run perf:curation            # STUDY="Study B" CONCEPT="Variable A" by default; PAGE_SIZE, START and END narrow the records
npm run perf:blocks              # FIELD="Field B" by default
npm run perf:analysis            # STUDY="Study B" CONCEPT="Variable A" by default: dataset selection in the analysis editor
```

Other settings: `BREEDVIEW_URL` (default `http://localhost:8080`), `MAILHOG_URL` (default `http://localhost:8025`).

## What is covered

- `smoke.test.mjs`: every routed page renders for a signed-in user without console errors.
- `invitation.test.mjs`: invite with a team offer, the emailed link, registration with the prefilled read-only email
  and the accepted team, verification from the emailed link, login with the affiliation, and refusal of the used link.

## Adding a test

Copy the shape of `invitation.test.mjs`: launch a browser in `before`, use the helpers, assert on what the page shows,
close in `after`. Keep each test file independent of the others, and make the data it creates unique per run with
`uniqueName`. For flows that need an email, use `waitForMail(address, subjectFragment, { after })` with the time the
test started, so an older message for the same address is not mistaken for the new one.

## What is not here

Unit tests for composables and components would use Vitest with Vue Test Utils; nothing of that kind exists yet, and
the e2e tests above are not a substitute for it. They are slow (a minute or more each), need the whole stack running,
and tell you that a flow broke, not where.
