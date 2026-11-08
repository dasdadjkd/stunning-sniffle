export const adapter = {
  async signup(page, { identity, baseUrl, otp }) {
    await page.goto(baseUrl);
    await page.getByLabel('First name').fill(identity.firstName);
    await page.getByLabel('Last name').fill(identity.lastName);
    await page.getByLabel('Email').fill(identity.email);
    await page.getByLabel('Password', { exact: true }).fill(identity.password);
    await page.getByLabel('Confirm password').fill(identity.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/check-email/);

    const code = await otp();
    await page.getByLabel('Verification code').fill(code);
    await page.getByRole('button', { name: /verify/i }).click();
    await page.waitForURL(/onboarding/);
  },

  async reachPlan(page) {
    await page.getByRole('link', { name: /skip/i }).click();
    await page.waitForURL(/plan/);
    await page.getByRole('button', { name: /choose plan/i }).click();
    await page.waitForURL(/upgrade/);
  },

  async fillUpgrade(page, { profile }) {
    await page.getByLabel('First name').fill(profile.firstName);
    await page.getByLabel('Last name').fill(profile.lastName);
    await page.getByLabel('Card number').fill('4242424242424242');
    await page.getByLabel('Expiry').fill('12/34');
    await page.getByLabel('CVC').fill('123');
  },
};
