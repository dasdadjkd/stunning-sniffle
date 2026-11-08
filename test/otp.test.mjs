import assert from 'node:assert/strict';
import test from 'node:test';

import { extractCode, mailpitMailbox, pollForCode } from '../src/otp.mjs';
import { buildMailbox } from '../src/mailbox.mjs';
import { loadConfig } from '../src/config.mjs';

const withEnv = (extra) => loadConfig({ BASE_URL: 'http://localhost:3000', ...extra });

test('extracts a compact six-digit code', () => {
  assert.equal(extractCode('Your Hoplite code\n752384\nExpires in 10 minutes.'), '752384');
});

test('extracts a space-separated code', () => {
  assert.equal(extractCode('Enter this code: 7 5 2 3 8 4'), '752384');
});

test('returns null when there is no code, ignoring long numbers', () => {
  assert.equal(extractCode('Order 1234567890 placed'), null);
  assert.equal(extractCode(''), null);
  assert.equal(extractCode(null), null);
});

test('pollForCode retries until the message lands', async () => {
  let calls = 0;
  const mailbox = {
    async latestText() {
      calls += 1;
      return calls < 3 ? null : 'code: 481920';
    },
  };
  const code = await pollForCode({ mailbox, address: 'a@example.test', intervalMs: 1 });
  assert.equal(code, '481920');
  assert.equal(calls, 3);
});

test('pollForCode survives a transient mailbox error', async () => {
  let calls = 0;
  const mailbox = {
    async latestText() {
      calls += 1;
      if (calls === 1) throw new Error('connection reset');
      return 'code: 111222';
    },
  };
  assert.equal(await pollForCode({ mailbox, address: 'a@example.test', intervalMs: 1 }), '111222');
});

test('pollForCode times out with the last error for context', async () => {
  const mailbox = {
    async latestText() {
      throw new Error('boom');
    },
  };
  await assert.rejects(
    pollForCode({ mailbox, address: 'a@example.test', timeoutMs: 20, intervalMs: 5 }),
    /last error: boom/,
  );
});

test('mailpitMailbox reads the newest message for a recipient', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url.includes('/search')) {
      return { ok: true, json: async () => ({ messages: [{ ID: 'abc' }] }) };
    }
    return { ok: true, json: async () => ({ Text: 'your code 909090', HTML: '' }) };
  };
  const mailbox = mailpitMailbox({ url: 'http://localhost:8025/', fetchImpl });
  assert.equal(await mailbox.latestText('a+b@example.test'), 'your code 909090\n');
  assert.match(seen[0], /to%3Aa%2Bb%40example\.test/);
});

test('buildMailbox defaults to mailpit and rejects unknown providers', async () => {
  const mailbox = await buildMailbox(withEnv({}));
  assert.equal(typeof mailbox.latestText, 'function');
  await assert.rejects(buildMailbox(withEnv({ OTP_PROVIDER: 'gmail' })), /unknown OTP_PROVIDER/);
});

test('imap provider requires credentials', async () => {
  await assert.rejects(
    buildMailbox(withEnv({ OTP_PROVIDER: 'imap' })),
    /IMAP_HOST, IMAP_USER and IMAP_PASS are required/,
  );
});
