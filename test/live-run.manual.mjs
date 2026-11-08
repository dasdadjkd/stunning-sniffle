// End-to-end check against the local fixture app with a real browser.
// Run with: node test/live-run.manual.mjs
import { loadConfig } from '../src/config.mjs';
import { launchBrowser } from '../src/browser.mjs';
import { mailpitMailbox } from '../src/otp.mjs';
import { runPool } from '../src/runner.mjs';
import { startFixture } from './fixtures/fixture-server.mjs';

const fixture = await startFixture();
const config = loadConfig({
  BASE_URL: fixture.url,
  MAILPIT_URL: fixture.url,
  WORKERS: '3',
  EMAIL_DOMAIN: 'example.test',
  ACCOUNTS_FILE: '/tmp/live-accounts.txt',
  APP_ADAPTER: new URL('./fixtures/app-adapter.mjs', import.meta.url).pathname,
  BROWSER_CHANNEL: 'chromium',
});

const browser = await launchBrowser({ channel: config.browserChannel });
const notified = [];
const results = await runPool({
  config,
  adapter: await (await import(config.appAdapterPath)).adapter,
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
