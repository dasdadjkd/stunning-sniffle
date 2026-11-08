/**
 * Hoplite-shaped signup adapter.
 *
 * The harness contract is three methods (see ../adapter.mjs). Everything that
 * depends on the app's markup lives in ROUTES and SELECTORS below, so moving
 * this to a deployment you run means editing this file — not the harness, the
 * pool, the mailbox reader or the tests.
 *
 * Point BASE_URL at the deployment (see README, "Retargeting"), then adjust
 * the table until the flow goes through. Each selector is role- or
 * label-based on purpose: a markup change throws instead of silently filling
 * the wrong field.
 */

/** URL fragments the flow is expected to pass through. */
export const ROUTES = {
  signup: '/signup',
  afterSignup: /check[-_]?email|verify/i,
  afterVerify: /onboarding|welcome|app\//i,
  plan: /plan/i,
  upgrade: /upgrade|billing|checkout/i,
};

/** Selector table. Edit these, not the method bodies, to retarget. */
export const SELECTORS = {
  firstName: { label: /first name/i },
  lastName: { label: /last name/i },
  email: { label: /e-?mail/i },
  // Exact string so "Confirm password" and "Password strength" don't match.
  password: { label: 'Password', exact: true },
  confirmPassword: { label: /confirm password/i },
  createAccount: { role: 'button', name: /create account|sign up|continue/i },
  code: { label: /verification code|code/i },
  verify: { role: 'button', name: /verify|continue/i },
  skip: { role: 'link', name: /skip|not now|later/i },
  choosePlan: { role: 'button', name: /upgrade|choose plan|select plan/i },
  cardNumber: { label: /card number/i },
  cardExpiry: { label: /expir/i },
  cardCvc: { label: /cvc|security code/i },
};

function locator(page, spec) {
  if (spec.role) return page.getByRole(spec.role, { name: spec.name, exact: spec.exact });
  if (spec.label) return page.getByLabel(spec.label, { exact: spec.exact });
  if (spec.placeholder) return page.getByPlaceholder(spec.placeholder, { exact: spec.exact });
  throw new Error(`selector spec needs role, label or placeholder: ${JSON.stringify(spec)}`);
}

/**
 * Builds an adapter. Pass `{ routes, selectors }` to override any entry; the
 * defaults describe the standard Hoplite flow.
 */
export function createHopliteAdapter({ routes = ROUTES, selectors = SELECTORS, card = {} } = {}) {
  const cardDetails = () => ({
    number: card.number ?? process.env.TEST_CARD_NUMBER ?? '4242424242424242',
    expiry: card.expiry ?? process.env.TEST_CARD_EXPIRY ?? '12/34',
    cvc: card.cvc ?? process.env.TEST_CARD_CVC ?? '123',
  });

  return {
    async signup(page, { identity, baseUrl, otp }) {
      await page.goto(new URL(routes.signup, baseUrl).href);
      await locator(page, selectors.firstName).fill(identity.firstName);
      await locator(page, selectors.lastName).fill(identity.lastName);
      await locator(page, selectors.email).fill(identity.email);
      await locator(page, selectors.password).fill(identity.password);
      if (selectors.confirmPassword) {
        await locator(page, selectors.confirmPassword).fill(identity.password);
      }
      await locator(page, selectors.createAccount).click();
      if (routes.afterSignup) await page.waitForURL(routes.afterSignup);

      // The app's own code email still gates the account; this only reads it.
      const code = await otp();
      await locator(page, selectors.code).fill(code);
      await locator(page, selectors.verify).click();
      if (routes.afterVerify) await page.waitForURL(routes.afterVerify);
    },

    async reachPlan(page) {
      // Explicit steps: an onboarding change fails here instead of skipping
      // past verification unnoticed.
      await locator(page, selectors.skip).click();
      if (routes.plan) await page.waitForURL(routes.plan);
      await locator(page, selectors.choosePlan).click();
      if (routes.upgrade) await page.waitForURL(routes.upgrade);
    },

    async fillUpgrade(page, { identity, profile }) {
      const name = profile ?? { firstName: identity.firstName, lastName: identity.lastName };
      await locator(page, selectors.firstName).fill(name.firstName);
      await locator(page, selectors.lastName).fill(name.lastName);
      const { number, expiry, cvc } = cardDetails();
      await locator(page, selectors.cardNumber).fill(number);
      await locator(page, selectors.cardExpiry).fill(expiry);
      await locator(page, selectors.cardCvc).fill(cvc);
      return { readyForPayment: true };
    },
  };
}

export const adapter = createHopliteAdapter();
