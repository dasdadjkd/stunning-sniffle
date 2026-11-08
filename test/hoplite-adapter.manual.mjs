// End-to-end check of the Hoplite adapter against the local fixture app.
// Run with: node test/hoplite-adapter.manual.mjs
import os from 'node:os';
import path from 'node:path';

import { launchBrowser } from '../src/browser.mjs';
import { loadConfig } from '../src/config.mjs';
import { mailpitMailbox } from '../src/otp.mjs';
import { runPool } from '../src/runner.mjs';
import { createHopliteAdapter } from '../src/adapters/hoplite.mjs';
import { loadProfile } from '../src/adapters/profile.mjs';
import { startFixture } from './fixtures/fixture-server.mjs';

const fixture = await startFixture();
const config = loadConfig({
  BASE_URL: fixture.url,
  MAILPIT_URL: fixture.url,
  WORKERS: '2',
  EMAIL_DOMAIN: 'example.test',
  ACCOUNTS_FILE: path.join(os.tmpdir(), 'hoplite-adapter-accounts.txt'),
});

// Driven entirely from a JSON profile, so this exercises the same path a
// real retarget uses: `--profile profiles/fixture.json`.
const adapter = createHopliteAdapter(loadProfile(new URL('../profiles/fixture.json', import.meta.url)));

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
