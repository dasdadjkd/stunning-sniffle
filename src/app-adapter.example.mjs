// Copy to src/app-adapter.mjs and replace the selectors with your app's.
// Selectors are role/label based so a markup change fails loudly instead of
// silently filling the wrong field.
export const adapter = {
  async signup(page, { identity, baseUrl, otp }) {
    await page.goto(new URL('/signup', baseUrl).href);
    await page.getByLabel('First name').fill(identity.firstName);
    await page.getByLabel('Last name').fill(identity.lastName);
    await page.getByLabel('Email').fill(identity.email);
    await page.getByLabel('Password', { exact: true }).fill(identity.password);
    await page.getByLabel('Confirm password').fill(identity.password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Blocks until the Mailpit inbox has the app's own verification email.
    const code = await otp();
    await page.getByLabel(/verification code/i).fill(code);
    await page.getByRole('button', { name: /verify/i }).click();
  },

  async reachPlan(page) {
    // Explicit steps, so an onboarding change fails instead of skipping blindly.
    await page.getByRole('link', { name: /^skip/i }).click();
    await page.getByRole('button', { name: /upgrade|choose plan/i }).click();
  },

  async fillUpgrade(page, { profile }) {
    await page.getByLabel(/first name/i).fill(profile.firstName);
    await page.getByLabel(/last name/i).fill(profile.lastName);
    // Stripe test-mode card fields rendered on your own domain.
    await page.getByLabel(/card number/i).fill(process.env.TEST_CARD_NUMBER);
    await page.getByLabel(/expir/i).fill(process.env.TEST_CARD_EXPIRY);
    await page.getByLabel(/cvc|security code/i).fill(process.env.TEST_CARD_CVC);
  },
};
