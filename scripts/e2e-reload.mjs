// End-to-end check of auto-reload for local files: loads dist/ into headless
// Edge/Chromium, opens a temporary .md via file://, edits the file on disk, and
// checks that the page updates. Drives the browser over the DevTools protocol.
// Usage: npm run build && node scripts/e2e-reload.mjs
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const BROWSER =
  process.env.CHROME_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = await mkdtemp(join(tmpdir(), 'mv-reload-'));
const profile = join(work, 'profile');
const mdPath = join(work, 'reload-test.md');
await copyFile('test/sample.md', mdPath);

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
  // Wait for DevTools to come up.
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(200);
    port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((s) => s.split('\n')[0]).catch(() => null);
  }
  if (!port) throw new Error('DevTools did not start');

  const target = await fetch(`http://127.0.0.1:${port}/json/new?${pathToFileURL(mdPath).href}`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg.result);
    if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.text);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await send('Runtime.enable');

  const waitFor = async (expr, ms) => {
    for (let t = 0; t < ms; t += 250) {
      if (await evaluate(expr)) return true;
      await sleep(250);
    }
    return false;
  };

  const rendered = await waitFor(`document.documentElement.classList.contains('mv-active')`, 10000);
  console.log(`rendered: ${rendered}`);
  if (!rendered) throw new Error('page was not rendered (is file access allowed for the extension?)');

  await writeFile(mdPath, `${await readFile(mdPath, 'utf8')}\n\n## Reload marker 12345\n`);
  const reloaded = await waitFor(`!!document.getElementById('reload-marker-12345')`, 8000);
  console.log(`reloaded after edit: ${reloaded}`);
  console.log(`last read: ${await evaluate('document.documentElement.dataset.mvReload')}`);
  // Polling must not add session-history entries (that would break Back).
  const historyLength = await evaluate('history.length');
  console.log(`history.length: ${historyLength}`);
  if (historyLength > 2) throw new Error('auto-reload added history entries');
  if (consoleErrors.length) console.log('page errors:', consoleErrors);
  ok = reloaded;
  ws.close();
} finally {
  browser.kill();
  await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
}
process.exit(ok ? 0 : 1);
