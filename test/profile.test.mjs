import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { compileRoutes, compileSelectors, loadProfile } from '../src/adapters/profile.mjs';
import { createHopliteAdapter } from '../src/adapters/hoplite.mjs';
import { loadConfig, parseArgs } from '../src/config.mjs';
import { loadAdapter } from '../src/adapter.mjs';

const writeProfile = (value) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'profile-')), 'p.json');
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
};

test('route strings become case-insensitive patterns', () => {
  const routes = compileRoutes({ signup: '/join', afterSignup: 'check-?email' });
  assert.equal(routes.signup, '/join');
  assert.match('http://x.test/CheckEmail', routes.afterSignup);
});

test('selectors compile label and role patterns', () => {
  const selectors = compileSelectors({
    email: { labelPattern: 'e-?mail' },
    createAccount: { role: 'button', namePattern: 'sign up' },
  });
  assert.ok(selectors.email.labelPattern instanceof RegExp);
  assert.equal(selectors.createAccount.role, 'button');
});

test('a selector with no accessible locator is rejected at load time', () => {
  assert.throws(() => compileSelectors({ email: { exact: true } }), /profile selector "email"/);
});

test('loadProfile reports a missing file with its path', () => {
  const missing = path.join('nope', 'missing.json');
  assert.throws(
    () => loadProfile(missing),
    (error) => {
      // Compared against path.resolve so the assertion holds on Windows too.
      assert.match(error.message, /profile not found: /);
      assert.ok(error.message.includes(path.resolve(missing)), error.message);
      return true;
    },
  );
});

test('a profile drives the same adapter as the built-in tables', async () => {
  const file = writeProfile({
    routes: { signup: '/join' },
    selectors: {
      firstName: { labelPattern: 'given name' },
      lastName: { labelPattern: 'family name' },
      email: { labelPattern: 'e-?mail' },
      password: { label: 'Password', exact: true },
      confirmPassword: { labelPattern: 'confirm' },
      createAccount: { role: 'button', namePattern: 'create account' },
      code: { labelPattern: 'code' },
      verify: { role: 'button', namePattern: 'verify' },
    },
  });
  const adapter = createHopliteAdapter(loadProfile(file));
  const calls = [];
  const page = {
    goto: async (url) => calls.push(url),
    waitForURL: async () => {},
    getByLabel: (label) => ({ fill: async (v) => calls.push([label, v]) }),
    getByRole: () => ({ click: async () => {} }),
  };
  await adapter.signup(page, {
    identity: { firstName: 'A', lastName: 'B', email: 'a@b.test', password: 'p' },
    baseUrl: 'http://localhost:3000',
    otp: async () => '752384',
  });
  assert.equal(calls[0], 'http://localhost:3000/join');
});

test('--target and --profile override env without skipping the guard', () => {
  const env = { ALLOWED_HOSTS: 'staging.acme.test', ADAPTER_PROFILE: 'profiles/hoplite.json' };
  const config = loadConfig(env, ['--target', 'https://staging.acme.test', '--dry-run']);
  assert.equal(config.baseUrl, 'https://staging.acme.test');
  assert.equal(config.adapterProfile, 'profiles/hoplite.json');
  assert.equal(config.dryRun, true);
  assert.throws(
    () => loadConfig(env, ['--target', 'https://app.hoplite.sh']),
    /refusing to drive/,
  );
});

test('parseArgs accepts --key=value and ignores unknown flags', () => {
  assert.deepEqual(parseArgs(['--target=https://a.test', '--nope']), {
    dryRun: false,
    target: 'https://a.test',
    profile: null,
    adapter: null,
  });
});

test('loadAdapter builds the adapter from a profile', async () => {
  const config = loadConfig(
    { BASE_URL: 'http://localhost:3000', ADAPTER_PROFILE: 'profiles/hoplite.json' },
    [],
  );
  const adapter = await loadAdapter(config);
  for (const name of ['signup', 'reachPlan', 'fillUpgrade']) {
    assert.equal(typeof adapter[name], 'function');
  }
});
