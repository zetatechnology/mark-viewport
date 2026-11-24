// Builds each extension entry as a self-contained IIFE bundle into dist/.
// Content scripts cannot be ES modules, so every entry is built separately.
import { build } from 'vite';
import { resolve } from 'node:path';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
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

// Heavy renderers, imported by the content script on demand from lazy/ (listed
// in web_accessible_resources). Built as ES modules so Mermaid's diagram types
// stay in separate chunks and only the ones a page uses are loaded.
await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist/lazy',
    emptyOutDir: true,
    target: 'chrome110',
    minify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
    watch: watch ? {} : null,
    lib: {
      entry: { mermaid: resolve('src/lazy/mermaid.ts'), katex: resolve('src/lazy/katex.ts') },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rolldownOptions: {
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});

// KaTeX stylesheet + fonts (woff2 only: every browser we support picks it first).
mkdirSync('dist/lazy/katex/fonts', { recursive: true });
cpSync('node_modules/katex/dist/katex.min.css', 'dist/lazy/katex/katex.min.css');
for (const f of readdirSync('node_modules/katex/dist/fonts').filter((f) => f.endsWith('.woff2'))) {
  cpSync(`node_modules/katex/dist/fonts/${f}`, `dist/lazy/katex/fonts/${f}`);
}

const count = writeNotices('dist/THIRD_PARTY_NOTICES.txt');
if (!watch) console.log(`Built to dist/ (${count} third-party notices)`);
