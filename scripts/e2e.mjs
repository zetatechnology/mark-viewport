// End-to-end check: loads the built extension (dist/) into headless Chrome,
// opens test/sample.md served as text/plain, and reports what got rendered.
// Usage: npm run build && node scripts/e2e.mjs [--screenshot out.png]
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const shotArg = process.argv.indexOf('--screenshot');
const shot = shotArg > 0 ? resolve(process.argv[shotArg + 1]) : null;

const server = createServer(async (req, res) => {
  try {
    const body = await readFile(join('test', new URL(req.url, 'http://x').pathname));
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/sample.md`;
const profile = await mkdtemp(join(tmpdir(), 'mv-e2e-'));

try {
  const { stdout } = await promisify(execFile)(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--hide-scrollbars',
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      `--load-extension=${resolve('dist')}`,
      `--user-data-dir=${profile}`,
      '--window-size=1280,800',
      '--virtual-time-budget=15000',
      shot ? `--screenshot=${shot}` : '--dump-dom',
      url,
    ],
    { timeout: 120000, maxBuffer: 64 * 1024 * 1024 },
  );
  if (shot) {
    console.log(`screenshot: ${shot}`);
  } else {
    const count = (re) => (stdout.match(re) ?? []).length;
    const report = {
      rendered: stdout.includes('mv-active'),
      headings: count(/<h[1-6][^>]* id=/g),
      diagramBoxes: count(/class="mv-diagram[" ]/g),
      diagramsRendered: count(/<svg[^>]* id="mv-mermaid-\d+"/g),
      diagramErrors: count(/mv-diagram-error/g),
      mathRendered: count(/mv-math-done/g),
      mathErrors: count(/mv-math-error/g),
      katexCss: stdout.includes('katex.min.css'),
      copyButtons: count(/class="mv-copy/g),
      alerts: count(/class="markdown-alert /g),
    };
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  server.close();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
