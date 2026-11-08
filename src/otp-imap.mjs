/**
 * IMAP reader for a staging mailbox you control.
 *
 * imapflow + mailparser are optional dependencies, so the Mailpit path stays
 * dependency-free. Use an app password scoped to the test mailbox, never a
 * primary account credential.
 */
export async function imapMailbox({
  host,
  port = 993,
  secure = true,
  user,
  pass,
  mailbox = 'INBOX',
  lookbackMinutes = 15,
}) {
  if (!host || !user || !pass) {
    throw new Error('IMAP_HOST, IMAP_USER and IMAP_PASS are required for OTP_PROVIDER=imap');
  }
  let ImapFlow;
  let simpleParser;
  try {
    ({ ImapFlow } = await import('imapflow'));
    ({ simpleParser } = await import('mailparser'));
  } catch {
    throw new Error(
      'imapflow and mailparser are not installed; run `npm install imapflow mailparser`',
    );
  }

  const client = new ImapFlow({
    host,
    port: Number(port),
    secure: Boolean(secure),
    auth: { user, pass },
    logger: false,
  });

  const connect = async () => {
    if (!client.usable) await client.connect();
  };

  return {
    async latestText(address) {
      await connect();
      const lock = await client.getMailboxLock(mailbox);
      try {
        const since = new Date(Date.now() - lookbackMinutes * 60_000);
        // Server-side `to:` filter keeps parallel workers from reading each
        // other's codes.
        const uids = await client.search({ to: address, since }, { uid: true });
        if (!uids?.length) return null;
        const message = await client.fetchOne(
          uids[uids.length - 1],
          { source: true },
          { uid: true },
        );
        if (!message?.source) return null;
        const parsed = await simpleParser(message.source);
        return `${parsed.text ?? ''}\n${parsed.html || ''}`;
      } finally {
        lock.release();
      }
    },
    async close() {
      if (client.usable) await client.logout().catch(() => {});
    },
  };
}
