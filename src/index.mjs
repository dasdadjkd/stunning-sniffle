import { loadAdapter } from './adapter.mjs';
import { launchBrowser } from './browser.mjs';
import { loadConfig } from './config.mjs';
import { buildMailbox } from './mailbox.mjs';
import { runPool } from './runner.mjs';
import { makeNotifier } from './telegram.mjs';

const log = (line) => console.log(line);

async function main() {
  const config = loadConfig();
  const adapter = await loadAdapter(config);
  const notify = makeNotifier({
    token: config.telegramToken,
    chatId: config.telegramChatId,
    log,
  });

  log(
    `target=${config.baseUrl} workers=${config.workers} ` +
      `mode=${config.dryRun ? 'dry-run' : 'browser'} otp=${config.otpProvider} ` +
      `browser=${config.browserChannel}` +
      (config.adapterProfile ? ` profile=${config.adapterProfile}` : ''),
  );

  let browser = null;
  let mailbox = null;
  if (!config.dryRun) {
    mailbox = await buildMailbox(config);
    browser = await launchBrowser({
      channel: config.browserChannel,
      headless: config.headless,
      log,
    });
  }

  try {
    const results = await runPool({ config, adapter, browser, notify, log, mailbox });
    const ready = results.filter((r) => r.ok).length;
    log(`done: ${ready}/${results.length} awaiting payment`);
    process.exitCode = ready === results.length ? 0 : 1;
  } finally {
    await browser?.close();
    await mailbox?.close?.();
  }
}

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exitCode = 1;
});
