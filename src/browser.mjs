/**
 * Launch options for the shared browser process.
 *
 * `BROWSER_CHANNEL` lets a run use a browser that is already installed
 * (chrome, msedge) instead of Playwright's downloaded build. That avoids the
 * CDN download entirely, which matters on networks that reset large transfers.
 */
export function browserLaunchOptions({ channel, headless = true } = {}) {
  const options = { headless: Boolean(headless) };
  if (channel && channel !== 'chromium') options.channel = channel;
  return options;
}

export const CHANNELS = ['chromium', 'chrome', 'msedge'];

export async function launchBrowser({ channel, headless = true, log = () => {} }) {
  const { chromium } = await import('playwright');
  const options = browserLaunchOptions({ channel, headless });
  try {
    return await chromium.launch(options);
  } catch (error) {
    const hint =
      options.channel === undefined
        ? 'Playwright\'s bundled Chromium is missing. Either run ' +
          '`npx playwright install chromium`, or set BROWSER_CHANNEL=msedge ' +
          '(default on Windows) or BROWSER_CHANNEL=chrome to use an installed browser.'
        : `The ${options.channel} channel failed to start. Check that it is installed, ` +
          'or try BROWSER_CHANNEL=msedge (Windows) / chrome.';
    log(`[browser] ${hint}`);
    throw new Error(`${error.message}\n${hint}`);
  }
}
