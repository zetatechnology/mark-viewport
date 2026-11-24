// Writes the license texts of all bundled (production) dependencies, which the
// MIT/BSD/Apache licenses require to ship with the distributed package.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function writeNotices(outFile) {
  const dirs = execSync('npm ls --omit=dev --all --parseable', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((d) => d.includes('node_modules') && !/[\\/]@types[\\/]/.test(d));

  const seen = new Set();
  const sections = [];
  for (const dir of [...new Set(dirs)].sort()) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const id = `${pkg.name}@${pkg.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
    const text = licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : `License: ${pkg.license}`;
    sections.push(`${id} (${pkg.license})\n${pkg.homepage ?? ''}\n\n${text}`);
  }

  const header = 'Mark Viewport bundles the following third-party software.\n';
  writeFileSync(outFile, [header, ...sections].join(`\n\n${'='.repeat(72)}\n\n`) + '\n');
  return seen.size;
}
