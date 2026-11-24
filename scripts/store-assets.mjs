// Generates Chrome Web Store screenshots (1280x800) and the small promo tile
// (440x280) into store/assets/, using headless Chrome and the built dist/.
//
// Each screenshot page mimics a plain-text .md document and runs the real
// content script with a stubbed `chrome` API, so what you see is the actual
// rendering. Run `npm run build` first.
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// Absolute: Chrome does not resolve --screenshot paths against our cwd.
const OUT = resolve('store/assets');

const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const scenes = {
  // name: { theme, action (JS run after render) }
  'screenshot-1-light': { theme: 'light', action: '' },
  // Headless --screenshot does not capture a scrolled viewport, so every scene
  // shows the top of the page.
  'screenshot-2-dark': { theme: 'dark', action: '' },
  'screenshot-3-source': { theme: 'light', action: `document.querySelectorAll('.mv-btn')[1].click();` },
};

async function shotPage(theme, action) {
  const md = await readFile('store/demo.md', 'utf8');
  const messages = await readFile('dist/_locales/en/messages.json', 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/content.css"></head><body><pre>${esc(md)}</pre>
<script>
Object.defineProperty(document, 'contentType', { get: () => 'text/plain' });
const msgs = ${messages};
window.chrome = {
  i18n: { getMessage: (k) => msgs[k]?.message ?? '' },
  storage: { sync: { get: async (d) => ({ ...d, theme: ${JSON.stringify(theme)} }), set: async () => {} }, onChanged: { addListener() {} } },
  runtime: { sendMessage: async () => ({ ok: false }), onMessage: { addListener() {} } },
};
</script>
<script src="/content.js"></script>
<script>setTimeout(() => { ${action} }, 200);</script>
</body></html>`;
}

async function promoPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 440px; height: 280px; overflow: hidden; }
  body { display: flex; align-items: center; gap: 24px; padding: 0 36px; box-sizing: border-box;
    font-family: "Segoe UI", "Noto Sans", sans-serif; color: #fff;
    background: linear-gradient(135deg, #2f6feb 0%, #1a4fb8 100%); }
  img { width: 104px; height: 104px; border-radius: 22px; box-shadow: 0 8px 24px #0004; }
  h1 { margin: 0 0 8px; font-size: 34px; font-weight: 700; letter-spacing: -0.5px; }
  p { margin: 0; font-size: 17px; line-height: 1.4; opacity: 0.92; }
</style></head><body>
  <img src="/icons/icon128.png" alt="">
  <div><h1>Mark Viewport</h1><p>Markdown files,<br>beautifully rendered<br>in Chrome.</p></div>
</body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/shot/') && url.pathname.endsWith('.md')) {
      const s = scenes[url.pathname.slice(6, -3)];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(await shotPage(s.theme, s.action));
    } else if (url.pathname === '/promo.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(await promoPage());
    } else {
      const body = await readFile(join('dist', url.pathname));
      res.writeHead(200, { 'content-type': TYPES[extname(url.pathname)] ?? 'application/octet-stream' }).end(body);
    }
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

await mkdir(OUT, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'mv-shot-'));

// Must be async: a sync exec would block this process's HTTP server, which
// Chrome is waiting on.
const run = promisify(execFile);
async function capture(url, file, w, h) {
  await run(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--window-size=${w},${h}`,
    '--virtual-time-budget=3000',
    `--screenshot=${file}`,
    url,
  ], { timeout: 60000 });
  console.log(file);
}

try {
  for (const name of Object.keys(scenes)) await capture(`${base}/shot/${name}.md`, join(OUT, `${name}.png`), 1280, 800);
  await capture(`${base}/promo.html`, join(OUT, 'promo-small-440x280.png'), 440, 280);
} finally {
  server.close();
  await rm(profile, { recursive: true, force: true });
}
