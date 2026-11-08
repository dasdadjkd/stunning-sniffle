import assert from 'node:assert/strict';
import test from 'node:test';

import { assertTestTarget, isTestHost, loadConfig, parseEnvFile } from '../src/config.mjs';
import { makeIdentity } from '../src/identity.mjs';
import { makeNotifier } from '../src/telegram.mjs';

test('accepts local and test hosts', () => {
  for (const url of [
    'http://localhost:3000',
    'http://127.0.0.1:8080/app',
    'https://staging.example.test',
    'http://app.localhost',
  ]) {
    assert.doesNotThrow(() => assertTestTarget(url));
  }
});

test('refuses production hosts', () => {
  for (const url of ['https://app.hoplite.sh', 'https://checkout.stripe.com/pay/x']) {
    assert.throws(() => assertTestTarget(url), /refusing to drive/);
  }
});

test('allowlist lets an owned staging host through', () => {
  assert.equal(isTestHost('staging.acme.dev'), false);
  assert.doesNotThrow(() => assertTestTarget('https://staging.acme.dev', ['staging.acme.dev']));
});

test('parses env files and ignores comments', () => {
  const env = parseEnvFile('# comment\nBASE_URL=http://localhost:1234\nQUOTED="a b"\n\n');
  assert.deepEqual(env, { BASE_URL: 'http://localhost:1234', QUOTED: 'a b' });
});

test('config rejects bad worker counts and non-http targets', () => {
  assert.throws(() => loadConfig({ BASE_URL: 'http://localhost:3000', WORKERS: '0' }), /WORKERS/);
  assert.throws(() => loadConfig({ BASE_URL: 'ftp://localhost' }), /http or https/);
});

test('browser channel accepts installed browsers and rejects unknown ones', () => {
  assert.equal(loadConfig({ BASE_URL: 'http://localhost:3000' }).browserChannel, 'chromium');
  assert.equal(
    loadConfig({ BASE_URL: 'http://localhost:3000', BROWSER_CHANNEL: 'msedge' }).browserChannel,
    'msedge',
  );
  assert.throws(
    () => loadConfig({ BASE_URL: 'http://localhost:3000', BROWSER_CHANNEL: 'firefox' }),
    /BROWSER_CHANNEL must be one of/,
  );
});

test('identities are unique and use the configured domain', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) {
    const id = makeIdentity({ emailDomain: 'example.test', workerId: i });
    assert.match(id.email, /@example\.test$/);
    assert.ok(id.password.length >= 10);
    assert.ok(!seen.has(id.email));
    seen.add(id.email);
  }
});

test('notifier reports disabled without network access', async () => {
  const lines = [];
  const notify = makeNotifier({ token: null, chatId: null, log: (l) => lines.push(l) });
  const result = await notify('hello');
  assert.equal(result.delivered, false);
  assert.match(lines[0], /telegram:off/);
});
