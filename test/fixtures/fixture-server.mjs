import http from 'node:http';

/**
 * Minimal stand-in for an app with email verification plus a Mailpit-shaped
 * inbox API, so the whole flow can be exercised without touching a real
 * service.
 */
export async function startFixture() {
  const accounts = new Map();
  const inbox = [];
  let nextId = 1;

  const page = (bodyHtml) => `<!doctype html><html><body>${bodyHtml}</body></html>`;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/api/v1/search') {
      const to = (url.searchParams.get('query') || '').replace(/^to:/, '');
      const messages = inbox
        .filter((m) => m.to === to)
        .slice(-1)
        .map((m) => ({ ID: m.id }));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ messages }));
      return;
    }

    if (url.pathname.startsWith('/api/v1/message/')) {
      const id = url.pathname.split('/').pop();
      const message = inbox.find((m) => m.id === id);
      res.writeHead(message ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(message ? { Text: message.text, HTML: '' } : {}));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/signup') {
      const body = await new Response(req).json();
      const code = String(100000 + Math.floor(Math.random() * 900000));
      accounts.set(body.email, { ...body, code, verified: false });
      const id = String(nextId++);
      inbox.push({
        id,
        to: body.email,
        text: `Your verification code\n${code}\nIt expires in 10 minutes.`,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ next: '/check-email' }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/verify') {
      const body = await new Response(req).json();
      const account = accounts.get(body.email);
      const ok = account && account.code === body.code;
      if (ok) account.verified = true;
      res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ next: ok ? '/onboarding' : null }));
      return;
    }

    const html = await renderRoute(url.pathname);
    res.writeHead(html ? 200 : 404, { 'content-type': 'text/html' });
    res.end(html ?? 'not found');
  });

  const renderRoute = async (pathname) => {
    if (pathname === '/') {
      return page(`
        <form id="signup">
          <label>First name <input name="firstName"></label>
          <label>Last name <input name="lastName"></label>
          <label>Email <input name="email"></label>
          <label>Password <input name="password" type="password"></label>
          <label>Confirm password <input name="confirm" type="password"></label>
          <button type="submit">Create account</button>
        </form>
        <script>
          document.getElementById('signup').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            const res = await fetch('/api/signup', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(data),
            });
            const { next } = await res.json();
            location.href = next + '?email=' + encodeURIComponent(data.email);
          });
        </script>`);
    }
    if (pathname === '/check-email') {
      return page(`
        <h1>Check your email</h1>
        <label>Verification code <input name="code"></label>
        <button id="verify">Verify</button>
        <script>
          document.getElementById('verify').addEventListener('click', async () => {
            const email = new URLSearchParams(location.search).get('email');
            const code = document.querySelector('input[name=code]').value;
            const res = await fetch('/api/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, code }),
            });
            if (res.ok) location.href = (await res.json()).next;
            else document.body.insertAdjacentHTML('beforeend', '<p id=err>Wrong code</p>');
          });
        </script>`);
    }
    if (pathname === '/onboarding') {
      return page(`
        <h1>Welcome</h1>
        <a id="skip" href="/plan">Skip for now</a>`);
    }
    if (pathname === '/plan') {
      return page(`
        <h1>Choose your plan</h1>
        <button id="choose">Choose plan</button>
        <script>
          document.getElementById('choose').onclick = () => { location.href = '/upgrade'; };
        </script>`);
    }
    if (pathname === '/upgrade') {
      return page(`
        <h1>Upgrade</h1>
        <label>First name <input name="first"></label>
        <label>Last name <input name="last"></label>
        <label>Country <select name="country"><option>GB</option></select></label>
        <label>Card number <input name="card"></label>
        <label>Expiry <input name="exp"></label>
        <label>CVC <input name="cvc"></label>
        <p id="ready">ready</p>`);
    }
    return null;
  };

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    accounts,
    inbox,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
