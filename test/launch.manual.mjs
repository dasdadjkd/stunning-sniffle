// Manual check, not part of `npm test`: launches real browsers to confirm the
// channel wiring and the failure hint. Run with: node test/launch.manual.mjs
import { launchBrowser } from '../src/browser.mjs';

for (const channel of ['chromium', 'msedge']) {
  try {
    const browser = await launchBrowser({ channel, log: (l) => console.log(`   ${l}`) });
    const page = await browser.newPage();
    await page.setContent('<h1>hello</h1>');
    console.log(`${channel}: launched, text=${await page.evaluate(() => document.body.innerText)}`);
    await browser.close();
  } catch (error) {
    console.log(`${channel}: failed -> ${error.message.split('\n')[0]}`);
  }
}
