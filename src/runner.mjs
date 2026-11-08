import { appendAccount, makeIdentity } from './identity.mjs';
import { fakeCode, pollForCode } from './otp.mjs';
import { assertTestTarget } from './config.mjs';

export async function runOne({ config, adapter, browser, workerId, notify, log, mailbox }) {
  const identity = makeIdentity({
    emailDomain: config.emailDomain,
    password: config.password,
    workerId,
  });
  const label = `w${workerId} ${identity.email}`;
  const otp = async () => {
    if (config.dryRun) return fakeCode();
    // The app's own email still drives verification; this only reads it.
    return pollForCode({ mailbox, address: identity.email });
  };

  // One context per worker: separate cookies, localStorage and cache, sharing
  // only the browser process.
  const context = browser
    ? await browser.newContext({ viewport: { width: 1280, height: 900 } })
    : null;

  try {
    const page = context ? await context.newPage() : null;
    if (page) {
      // Fail closed if the app ever sends a worker to a different origin.
      page.on('framenavigated', (frame) => {
        if (frame !== page.mainFrame()) return;
        try {
          assertTestTarget(frame.url(), config.allowlist);
        } catch {
          throw new Error(`left the test target: ${frame.url()}`);
        }
      });
      await page.goto(config.baseUrl);
    }

    await adapter.signup(page, { identity, baseUrl: config.baseUrl, otp });
    log(`[ok] signed up ${label}`);

    await adapter.reachPlan(page ?? null, { identity });
    await adapter.fillUpgrade(page ?? null, {
      identity,
      profile: { firstName: identity.firstName, lastName: identity.lastName },
    });

    appendAccount(config.accountsFile, { ...identity, status: 'awaiting_payment', workerId });
    await notify(
      `Awaiting payment — ${identity.email} (${identity.firstName} ${identity.lastName}) ` +
        `on ${config.baseUrl}`,
    );
    return { ok: true, identity };
  } catch (error) {
    appendAccount(config.accountsFile, {
      ...identity,
      status: 'failed',
      workerId,
      error: error.message,
    });
    await notify(`Failed — ${identity.email}: ${error.message}`);
    log(`[fail] ${label}: ${error.message}`);
    return { ok: false, identity, error };
  } finally {
    await context?.close();
  }
}

export async function runPool({ config, adapter, browser, notify, log, mailbox }) {
  const results = [];
  let next = 0;
  const worker = async (workerId) => {
    while (next < config.workers) {
      next += 1;
      results.push(await runOne({ config, adapter, browser, workerId, notify, log, mailbox }));
    }
  };
  await Promise.all(Array.from({ length: config.workers }, (_, id) => worker(id)));
  return results;
}
