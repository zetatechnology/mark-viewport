// End-to-end check: loads the built extension (dist/) into headless Edge,
// opens test/sample.md served as text/plain, waits in real time, and checks
// what got rendered plus any console/load errors (e.g. resources refused by
// web_accessible_resources). Drives the browser over the DevTools protocol.
// Usage: npm run build && node scripts/e2e.mjs
// Edge by default: branded Chrome ignores --load-extension. Override with CHROME_PATH.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const BROWSER =
  process.env.CHROME_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What test/sample.md must produce.
const EXPECT = { headings: 12, diagrams: 2, diagramErrors: 1, math: 5, mathErrors: 0, alerts: 5, copyButtons: 2 };

const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join('test', new URL(req.url, 'http://x').pathname));
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const work = await mkdtemp(join(tmpdir(), 'mv-e2e-'));
const profile = join(work, 'profile');
const browser = spawn(BROWSER, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--remote-debugging-port=0',
  '--disable-features=DisableLoadExtensionCommandLineSwitch',
  `--load-extension=${resolve('dist')}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]);

let ok = false;
try {
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(200);
    port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((s) => s.split('\n')[0]).catch(() => null);
  }
  if (!port) throw new Error('DevTools did not start');

  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m.result);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    // 404s from the test server itself are expected (sample.md's <img src="x">, favicon).
    const entry = m.params?.entry;
    if (m.method === 'Log.entryAdded' && entry.level === 'error' && !entry.url?.startsWith('http://127.0.0.1:'))
      errors.push(`${entry.text} ${entry.url ?? ''}`);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/sample.md` });

  // Wait (real time) until diagrams and math have settled.
  const snapshot = () =>
    evaluate(`JSON.stringify({
      rendered: document.documentElement.classList.contains('mv-active'),
      headings: document.querySelectorAll('.markdown-body :is(h1,h2,h3,h4,h5,h6)[id]').length,
      diagrams: document.querySelectorAll('.mv-diagram svg').length,
      diagramErrors: document.querySelectorAll('.mv-diagram-error').length,
      math: document.querySelectorAll('.mv-math-done').length,
      mathErrors: document.querySelectorAll('.mv-math-error').length,
      alerts: document.querySelectorAll('.markdown-alert').length,
      copyButtons: document.querySelectorAll('.mv-copy').length,
    })`).then((s) => (s ? JSON.parse(s) : {}));
  let result = {};
  for (let t = 0; t < 20000; t += 500) {
    await sleep(500);
    result = await snapshot();
    if (Object.entries(EXPECT).every(([k, v]) => result[k] === v)) break;
  }
  ws.close();

  console.log(JSON.stringify(result, null, 2));
  const mismatches = Object.entries(EXPECT).filter(([k, v]) => result[k] !== v).map(([k, v]) => `${k}: expected ${v}, got ${result[k]}`);
  if (mismatches.length) console.log('MISMATCH\n  ' + mismatches.join('\n  '));
  if (errors.length) console.log(`ERRORS (${errors.length})\n  ` + [...new Set(errors)].slice(0, 20).join('\n  '));
  ok = result.rendered && mismatches.length === 0 && errors.length === 0;
  console.log(ok ? 'PASS' : 'FAIL');
} finally {
  browser.kill();
  server.close();
  await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
}
process.exit(ok ? 0 : 1);
