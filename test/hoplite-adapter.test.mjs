import assert from 'node:assert/strict';
import test from 'node:test';

import { createHopliteAdapter, ROUTES, SELECTORS } from '../src/adapters/hoplite.mjs';

/** Records fill/click calls against a throwaway page stub. */
function fakePage() {
  const calls = [];
  const field = (name) => ({
    fill: async (value) => calls.push({ op: 'fill', name, value }),
    click: async () => calls.push({ op: 'click', name }),
  });
  return {
    calls,
    goto: async (url) => calls.push({ op: 'goto', url }),
    waitForURL: async (pattern) => calls.push({ op: 'wait', pattern }),
    getByRole: (role, { name }) => field(`${role}:${String(name)}`),
    getByLabel: (label) => field(`label:${String(label)}`),
    getByPlaceholder: (placeholder) => field(`placeholder:${String(placeholder)}`),
  };
}

const identity = {
  firstName: 'Amelia',
  lastName: 'Bennett',
  email: 'amelia.0-x@example.test',
  password: 'Qa-secret-value',
};

test('adapter exposes the three contract methods', () => {
  const adapter = createHopliteAdapter();
  for (const name of ['signup', 'reachPlan', 'fillUpgrade']) {
    assert.equal(typeof adapter[name], 'function', `missing ${name}()`);
  }
});

test('signup fills the form, submits, then the app-issued code', async () => {
  const page = fakePage();
  const adapter = createHopliteAdapter({ routes: { signup: '/join', afterSignup: /verify/i } });
  await adapter.signup(page, { identity, baseUrl: 'http://localhost:3000', otp: async () => '752384' });

  const fills = page.calls.filter((c) => c.op === 'fill').map((c) => c.value);
  assert.deepEqual(fills, [identity.firstName, identity.lastName, identity.email, identity.password, identity.password, '752384']);
  assert.equal(page.calls[0].url, 'http://localhost:3000/join');
  assert.ok(page.calls.some((c) => c.op === 'wait' && c.pattern.source === /verify/i.source));
});

test('reachPlan walks onboarding explicitly and opens the upgrade step', async () => {
  const page = fakePage();
  await createHopliteAdapter().reachPlan(page);
  assert.deepEqual(
    page.calls.filter((c) => c.op === 'click').length,
    2,
  );
  assert.ok(page.calls.some((c) => c.op === 'wait' && c.pattern.source === ROUTES.plan.source));
  assert.ok(page.calls.some((c) => c.op === 'wait' && c.pattern.source === ROUTES.upgrade.source));
});

test('fillUpgrade uses the injected card details', async () => {
  const page = fakePage();
  await createHopliteAdapter({ card: { number: '4000000000000002', expiry: '01/30', cvc: '999' } })
    .fillUpgrade(page, { identity, profile: { firstName: 'A', lastName: 'B' } });
  const fills = page.calls.filter((c) => c.op === 'fill').map((c) => c.value);
  assert.deepEqual(fills, ['A', 'B', '4000000000000002', '01/30', '999']);
});

test('default selectors are role or label based, never CSS markup', () => {
  for (const [key, spec] of Object.entries(SELECTORS)) {
    assert.ok(spec.role || spec.label || spec.placeholder, `${key} has no accessible locator`);
  }
});

test('a spec with no accessible locator fails loudly', async () => {
  const adapter = createHopliteAdapter({ selectors: { ...SELECTORS, firstName: {} } });
  await assert.rejects(
    adapter.signup(fakePage(), { identity, baseUrl: 'http://localhost:3000', otp: async () => '752384' }),
    /selector spec needs role, label or placeholder/,
  );
});
