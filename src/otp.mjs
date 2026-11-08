const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pulls a verification code out of a message body. Handles both the plain
 * "752384" form and the spaced "7 5 2 3 8 4" form some templates render.
 */
export function extractCode(text) {
  if (!text) return null;
  const compact = /\b(\d{6})\b/.exec(text);
  if (compact) return compact[1];
  const spaced = /(?<!\d)(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s+(\d)(?!\d)/.exec(text);
  return spaced ? spaced.slice(1, 7).join('') : null;
}

/**
 * Polls a mailbox until it yields a message containing a code.
 *
 * A mailbox is `{ latestText(address) => Promise<string|null> }` — the only
 * contract a provider must satisfy — so polling, timing and extraction stay
 * identical across providers.
 */
export async function pollForCode({
  mailbox,
  address,
  timeoutMs = 90_000,
  intervalMs = 2_000,
  signal,
}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('cancelled');
    try {
      const code = extractCode(await mailbox.latestText(address));
      if (code) return code;
    } catch (error) {
      // Transient fetch/IMAP errors should not end the wait; the next poll
      // usually succeeds.
      lastError = error;
    }
    await sleep(intervalMs);
  }
  const suffix = lastError ? ` (last error: ${lastError.message})` : '';
  throw new Error(`no verification code for ${address} within ${timeoutMs}ms${suffix}`);
}

/** Mailpit / MailHog reader, addressed by recipient. */
export function mailpitMailbox({ url, fetchImpl = fetch }) {
  const base = url.replace(/\/+$/, '');
  return {
    async latestText(address) {
      const query = encodeURIComponent(`to:${address}`);
      const listRes = await fetchImpl(`${base}/api/v1/search?query=${query}`);
      if (!listRes.ok) throw new Error(`mailpit search failed: ${listRes.status}`);
      const { messages = [] } = await listRes.json();
      const newest = messages[0];
      if (!newest) return null;
      const detailRes = await fetchImpl(`${base}/api/v1/message/${newest.ID}`);
      if (!detailRes.ok) throw new Error(`mailpit message failed: ${detailRes.status}`);
      const detail = await detailRes.json();
      return `${detail.Text ?? ''}\n${detail.HTML ?? ''}`;
    },
  };
}

export const fakeCode = (seed = Date.now()) => String(100000 + (seed % 900000));
