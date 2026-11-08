/**
 * Site adapter contract. Implement these three methods for the app under test;
 * the harness itself knows nothing about a specific product's markup.
 *
 *   signup(page, { identity, otp })       create the account and submit the
 *                                         emailed code returned by `await otp()`
 *   reachPlan(page, { identity })         walk to plan selection and open the
 *                                         upgrade step
 *   fillUpgrade(page, { identity, profile }) enter the profile fields that the
 *                                         app asks for on its own domain
 */

export const dryRunAdapter = {
  async signup(_page, { identity, otp }) {
    const code = await otp();
    if (!/^\d{6}$/.test(code)) throw new Error('dry-run: malformed code');
    return { verified: true, email: identity.email };
  },
  async reachPlan() {
    return { atPlanPage: true };
  },
  async fillUpgrade(_page, { profile }) {
    if (!profile.firstName || !profile.lastName) throw new Error('dry-run: missing name');
    return { readyForPayment: true };
  },
};

export async function loadAdapter(config) {
  if (config.dryRun) return dryRunAdapter;
  const { adapter } = await import(config.appAdapterPath).catch(() => {
    throw new Error(
      `no app adapter found at ${config.appAdapterPath}. Copy ` +
        'src/app-adapter.example.mjs to src/app-adapter.mjs and set the selectors, ' +
        'or point APP_ADAPTER at your own module.',
    );
  });
  for (const name of ['signup', 'reachPlan', 'fillUpgrade']) {
    if (typeof adapter?.[name] !== 'function') {
      throw new Error(`app adapter is missing ${name}()`);
    }
  }
  return adapter;
}
