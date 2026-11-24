// Packs dist/ into mark-viewport.zip for the Chrome Web Store.
// Uses bsdtar (bundled with Windows 10+ / macOS) because PowerShell 5.1's
// Compress-Archive writes backslash paths, which the store cannot read.
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';

const out = 'mark-viewport.zip';
rmSync(out, { force: true });
const entries = readdirSync('dist');
execFileSync('tar', ['-a', '-c', '-f', out, '-C', 'dist', ...entries], { stdio: 'inherit' });
console.log(`Wrote ${out} (${entries.length} top-level entries)`);
