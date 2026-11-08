import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCAL_SUFFIXES = ['.localhost', '.test', '.internal', '.invalid'];
const CHANNELS = new Set(['chromium', 'chrome', 'msedge']);
const DEFAULT_ADAPTER = fileURLToPath(new URL('./app-adapter.mjs', import.meta.url));

export function parseEnvFile(text) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length > 1 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function readEnv(path = '.env') {
  const file = fs.existsSync(path) ? parseEnvFile(fs.readFileSync(path, 'utf8')) : {};
  // The real environment wins over the file so CI can override without editing it.
  return { ...file, ...process.env };
}

export function isTestHost(hostname, allowlist = []) {
  const host = hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host)) return true;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return allowlist.includes(host);
}

/** Throws unless the target is an environment this harness may drive. */
export function assertTestTarget(baseUrl, allowlist = []) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`BASE_URL is not a valid URL: ${baseUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`BASE_URL must use http or https, got ${url.protocol}`);
  }
  if (!isTestHost(url.hostname, allowlist)) {
    throw new Error(
      `refusing to drive ${url.hostname}: target must be localhost, a local test ` +
        'domain, or a host listed in ALLOWED_HOSTS',
    );
  }
  return url;
}

export function loadConfig(env = readEnv(), argv = process.argv.slice(2)) {
  const allowlist = (env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const workers = Number(env.WORKERS || 3);
  if (!Number.isInteger(workers) || workers < 1 || workers > 20) {
    throw new Error('WORKERS must be an integer between 1 and 20');
  }
  const baseUrl = env.BASE_URL || 'http://localhost:3000';
  const otpProvider = (env.OTP_PROVIDER || 'mailpit').toLowerCase();
  const browserChannel = (env.BROWSER_CHANNEL || 'chromium').toLowerCase();
  if (!CHANNELS.has(browserChannel)) {
    throw new Error(
      `BROWSER_CHANNEL must be one of ${[...CHANNELS].join(', ')}, got "${env.BROWSER_CHANNEL}"`,
    );
  }
  return {
    baseUrl,
    url: assertTestTarget(baseUrl, allowlist),
    allowlist,
    workers,
    mailpitUrl: (env.MAILPIT_URL || 'http://localhost:8025').replace(/\/+$/, ''),
    otpProvider,
    appAdapterPath: env.APP_ADAPTER ? path.resolve(env.APP_ADAPTER) : DEFAULT_ADAPTER,
    browserChannel,
    headless: (env.HEADLESS ?? '1') !== '0',
    imap: {
      host: env.IMAP_HOST || null,
      port: Number(env.IMAP_PORT || 993),
      secure: (env.IMAP_SECURE ?? '1') !== '0',
      user: env.IMAP_USER || null,
      pass: env.IMAP_PASS || null,
      mailbox: env.IMAP_MAILBOX || 'INBOX',
    },
    emailDomain: env.EMAIL_DOMAIN || 'example.test',
    password: env.PASSWORD || null,
    telegramToken: env.TELEGRAM_BOT_TOKEN || null,
    telegramChatId: env.TELEGRAM_CHAT_ID || null,
    accountsFile: env.ACCOUNTS_FILE || 'accounts.txt',
    dryRun: argv.includes('--dry-run') || env.DRY_RUN === '1',
  };
}
