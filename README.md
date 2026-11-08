# Signup QA harness (local / staging only)

Exercises signup → email verification → plan selection against an environment
you control, with isolated parallel browser contexts, verification codes read
from Mailpit, and Telegram progress notifications.

## Scope and limits

- Targets `localhost`, `*.test`, `*.localhost`, `*.internal` or `*.invalid`, plus
  any host you list in `ALLOWED_HOSTS`. Anything else throws before a browser
  starts, and a worker that navigates to another origin is stopped.
- Codes come from a mailbox you own, through Mailpit/MailHog or IMAP. The app's
  own verification step is still performed; nothing bypasses it.
- Payment details belong to Stripe **test mode** on your own domain with
  official test cards. Hosted payment pages and live promotions are out of
  scope by design.
- Each worker calls `browser.newContext()`, so cookies, storage and cache are
  separate. Sessions are not fabricated or pre-warmed.

## Setup

```bash
cp .env.example .env       # fill in real values
npm install
npx playwright install chromium
```

### If the browser download fails

`npx playwright install chromium` fetches ~130 MB from `cdn.playwright.dev`.
Corporate proxies, some VPNs and flaky links reset that transfer
(`ECONNRESET`, `Download failure, code=1`). You do not need the download — drive
a browser that is already installed:

```bash
# In .env
BROWSER_CHANNEL=msedge    # Microsoft Edge, preinstalled on Windows
# BROWSER_CHANNEL=chrome  # or an installed Google Chrome
```

Other options, in order of preference:

1. `BROWSER_CHANNEL=msedge` — no download at all; the harness passes the channel
   straight to Playwright.
2. `npx playwright install chromium --only-shell` — fetches only the headless
   shell (~100 MB instead of the full browser).
3. Retry across a network without the resetting proxy, or set `HTTPS_PROXY` so
   Node and Playwright both honour it.
4. Point the downloader at a mirror with
   `PLAYWRIGHT_DOWNLOAD_HOST=https://<mirror> npx playwright install chromium`.

`HEADLESS=0` shows the window, which is useful when an adapter is still being
written.

Set `APP_ADAPTER` to keep several adapters side by side (`APP_ADAPTER=./qa/acme.mjs`).
It defaults to `src/app-adapter.mjs`.

## Retargeting

Three settings, no code changes:

```bash
BASE_URL=https://staging.your-domain.test   # what to drive
ALLOWED_HOSTS=staging.your-domain.test      # the guard's allowlist
ADAPTER_PROFILE=profiles/hoplite.json       # how that deployment's pages look
```

Every setting is also a flag, so one checkout drives several deployments
without editing `.env`:

```bash
npm start -- --target https://staging.acme.test --profile profiles/acme.json
npm start -- --target http://localhost:3000 --profile profiles/fixture.json --dry-run
```

`assertTestTarget` in `src/config.mjs` accepts `localhost`, `127.0.0.1`,
`*.localhost`, `*.test`, `*.internal` and `*.invalid` unconditionally, and
anything else only when it appears in `ALLOWED_HOSTS`. A worker that navigates
to an origin outside that set is stopped. Keep the allowlist to hosts you
operate — the guard is what makes a mass-signup tool safe to have around, and
`npm test` asserts that production hosts are still refused.

### Profiles

A profile is the deployment's flow in JSON — copy `profiles/hoplite.json` and
edit it:

```json
{
  "routes": { "signup": "/signup", "afterSignup": "check[-_]?email" },
  "selectors": {
    "email": { "labelPattern": "e-?mail" },
    "createAccount": { "role": "button", "namePattern": "sign up|create account" },
    "confirmPassword": false
  }
}
```

Strings in `routes` and any `*Pattern` field are compiled to case-insensitive
regexes; plain `label`/`placeholder`/`name` are passed to Playwright as-is, with
`"exact": true` when you need it. Set a selector to `false` to skip that field.
`"card"` in a profile supplies test-card values. Nothing else changes — the
pool, mailbox reader, code polling and notifications are untouched.

`profiles/fixture.json` describes the bundled fixture app, so
`node test/hoplite-adapter.manual.mjs` proves the JSON path end to end in a real
browser.

```bash
npm run dry-run                                  # pipeline only, no browser
node test/hoplite-adapter.manual.mjs             # adapter against the fixture app
```

Run Mailpit and point your app's SMTP config at it:

```bash
docker run --rm -p 8025:8025 -p 1025:1025 axllent/mailpit
```

## Implementing the adapter

```bash
npm run init-adapter      # creates src/app-adapter.mjs from the example
```

Then open `src/app-adapter.mjs` and set your selectors. Three methods:

| Method | Responsibility |
| --- | --- |
| `signup(page, { identity, baseUrl, otp })` | Fill the signup form, `await otp()` for the code, submit it |
| `reachPlan(page, { identity })` | Get through onboarding and open the upgrade step |
| `fillUpgrade(page, { identity, profile })` | Fill the profile fields the app asks for |

`npm run dry-run` runs the whole pipeline — identities, log, notification, pool —
without a browser, which is a useful smoke test while writing the adapter.

## Accepting the verification code

Every provider implements one method, `latestText(address)`, and the shared
`pollForCode` loop retries until a six-digit code appears (up to 90s, 2s
interval), accepting both `752384` and `7 5 2 3 8 4` layouts.

**1. Mailpit / MailHog (default, `OTP_PROVIDER=mailpit`)**

Point the app's SMTP config at Mailpit; the harness reads
`/api/v1/search?query=to:<address>` then `/api/v1/message/<id>`. Best for a local
stack — no credentials, and every message is inspectable.

```bash
docker run --rm -p 8025:8025 -p 1025:1025 axllent/mailpit
```

**2. IMAP (`OTP_PROVIDER=imap`)**

For a hosted staging app on a real test domain. Requires
`npm install imapflow mailparser` and an app password scoped to the staging
mailbox:

```bash
OTP_PROVIDER=imap
IMAP_HOST=imap.example.com
IMAP_USER=qa@staging.example.com
IMAP_PASS=<app password>
IMAP_MAILBOX=INBOX
```

Each poll issues a server-side `search({ to: address, since: <15 min ago> })`, so
parallel workers never read each other's codes.

**3. Test-only bypass hook**

Fastest and most deterministic in CI, if your app can be built with it: have the
staging app return the code in the signup response when `E2E_BYPASS_OTP=1`, and
have the adapter read it from the response body instead of calling `otp()`.
Gate it to non-production builds — it is a real authentication bypass otherwise.

**4. Inbound provider webhook**

For hosted staging mail (Mailgun/SendGrid/Postmark): add a route that forwards to
the test inbox API, then implement `latestText(address)` over it and register the
provider in `src/mailbox.mjs`.

Adding a provider is roughly ten lines: implement `latestText`, add a case in
`buildMailbox`, and the polling, extraction, retries and timeouts come from
`src/otp.mjs`.

## Output

- `accounts.txt` — one JSON object per line: email, password, status, worker,
  timestamp. Written with mode `0600` and gitignored; treat it as a credential
  file and delete it when the run is done.
- One Telegram message per account: address, name, and whether it is awaiting
  payment.

## Tests

```bash
npm test
```

The suite covers the target guard, env parsing, identity uniqueness and the
notification fallback; it needs no browser or network.

Two manual checks are not part of `npm test` because they need a browser:

```bash
node test/launch.manual.mjs   # confirms the channel wiring and failure hints
node test/live-run.manual.mjs # full signup -> code -> plan flow against a local fixture app
node test/hoplite-adapter.manual.mjs # the Hoplite adapter against the same fixture
```
