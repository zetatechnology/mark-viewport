// Builds each extension entry as a self-contained IIFE bundle into dist/.
// Content scripts cannot be ES modules, so every entry is built separately.
import { build } from 'vite';
import { resolve } from 'node:path';
import { writeNotices } from './notices.mjs';

const watch = process.argv.includes('--watch');

const entries = [
  ['content', 'src/content/index.ts'],
  ['background', 'src/background.ts'],
  ['options', 'src/options.ts'],
];

let first = true;
for (const [name, entry] of entries) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: 'public',
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: 'dist',
      emptyOutDir: first,
      copyPublicDir: first,
      target: 'chrome110',
      minify: true,
      sourcemap: false,
      watch: watch ? {} : null,
      lib: {
        entry: resolve(entry),
        formats: ['iife'],
        name: `MarkViewport_${name}`,
        fileName: () => `${name}.js`,
      },
    },
  });
  first = false;
}

const count = writeNotices('dist/THIRD_PARTY_NOTICES.txt');
if (!watch) console.log(`Built to dist/ (${count} third-party notices)`);
