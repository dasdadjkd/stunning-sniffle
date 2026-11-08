import assert from 'node:assert/strict';
import test from 'node:test';

import { browserLaunchOptions } from '../src/browser.mjs';

test('chromium uses the bundled build with no channel', () => {
  assert.deepEqual(browserLaunchOptions({ channel: 'chromium' }), { headless: true });
});

test('installed browsers are passed as a channel', () => {
  assert.deepEqual(browserLaunchOptions({ channel: 'msedge' }), {
    headless: true,
    channel: 'msedge',
  });
  assert.deepEqual(browserLaunchOptions({ channel: 'chrome', headless: false }), {
    headless: false,
    channel: 'chrome',
  });
});
