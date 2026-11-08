const API = 'https://api.telegram.org';

export function makeNotifier({ token, chatId, log = console.log }) {
  const enabled = Boolean(token && chatId);
  return async function notify(text) {
    if (!enabled) {
      log(`[telegram:off] ${text}`);
      return { delivered: false, reason: 'not configured' };
    }
    try {
      const res = await fetch(`${API}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (!res.ok) {
        log(`[telegram:error] ${res.status}`);
        return { delivered: false, reason: `http ${res.status}` };
      }
      return { delivered: true };
    } catch (error) {
      // A notification failure must not abort a signup run.
      log(`[telegram:error] ${error.message}`);
      return { delivered: false, reason: error.message };
    }
  };
}
