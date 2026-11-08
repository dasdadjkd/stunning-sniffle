// End-to-end check of the Hoplite adapter against the local fixture app.
// Run with: node test/hoplite-adapter.manual.mjs
import { launchBrowser } from '../src/browser.mjs';
import { loadConfig } from '../src/config.mjs';
import { mailpitMailbox } from '../src/otp.mjs';
import { runPool } from '../src/runner.mjs';
import { createHopliteAdapter } from '../src/adapters/hoplite.mjs';
import { startFixture } from './fixtures/fixture-server.mjs';

const fixture = await startFixture();
const config = loadConfig({
  BASE_URL: fixture.url,
  MAILPIT_URL: fixture.url,
  WORKERS: '2',
  EMAIL_DOMAIN: 'example.test',
  ACCOUNTS_FILE: '/tmp/hoplite-adapter-accounts.txt',
});

// The fixture mounts the signup form at `/` and has no payment step; only the
// routes differ from the real flow.
const adapter = createHopliteAdapter({
  routes: {
    signup: '/',
    afterSignup: /check-email/,
    afterVerify: /onboarding/,
    plan: /plan/,
    upgrade: /upgrade/,
  },
});

const browser = await launchBrowser({ channel: config.browserChannel });
const notified = [];
const results = await runPool({
  config,
  adapter,
  browser,
  mailbox: mailpitMailbox({ url: fixture.url }),
  notify: async (text) => notified.push(text),
  log: (line) => console.log(`  ${line}`),
});
await browser.close();
await fixture.close();

const ok = results.filter((r) => r.ok).length;
const verified = [...fixture.accounts.values()].filter((a) => a.verified).length;
console.log(`results: ${ok}/${results.length} ok, verified=${verified}, notified=${notified.length}`);
process.exitCode = ok === results.length && verified === results.length ? 0 : 1;
