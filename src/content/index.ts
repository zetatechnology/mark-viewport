import { renderMarkdown } from './render';
import { addCopyButtons, renderMath, renderMermaid } from './enhance';
import { loadSettings, onSettingsChanged, t, type Settings } from '../settings';

const MARKDOWN_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
const RELOAD_INTERVAL_MS = 1000;
const PROBE_PARAM = 'mv-probe';
const PROBE_MESSAGE = 'mark-viewport:probe';

declare global {
  interface Window {
    __markViewportLoaded?: boolean;
  }
}

/** Returns the raw Markdown if this tab shows a plain-text Markdown document, else null. */
function extractSource(): string | null {
  if (!MARKDOWN_TYPES.includes(document.contentType)) return null;
  if (!/\.(md|markdown)$/i.test(location.pathname)) return null;
  const body = document.body;
  if (!body) return null;
  const pre = body.querySelector(':scope > pre');
  return pre ? pre.textContent ?? '' : body.innerText;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function fileName(): string {
  const parts = decodeURIComponent(location.pathname).split('/');
  return parts[parts.length - 1] || location.href;
}

function main(source: string): void {
  const root = document.documentElement;
  let settings: Settings | null = null;
  let current = source;

  // ---- Build the page skeleton ----
  const article = el('article', 'markdown-body');
  const raw = el('pre', 'mv-raw');
  const main = el('main', 'mv-main');
  main.append(article, raw);

  const tocNav = el('nav');
  const toc = el('aside', 'mv-toc');
  toc.append(el('div', 'mv-toc-title', t('toc')), tocNav);

  const layout = el('div', 'mv-layout');
  layout.append(toc, main);

  const tocBtn = el('button', 'mv-btn', t('toc'));
  tocBtn.type = 'button';
  tocBtn.title = t('toggleToc');
  const rawBtn = el('button', 'mv-btn', t('showSource'));
  rawBtn.type = 'button';
  const toolbar = el('div', 'mv-toolbar');
  toolbar.append(tocBtn, rawBtn);

  for (const [name, content] of [
    ['viewport', 'width=device-width, initial-scale=1'],
    ['color-scheme', 'light dark'],
  ]) {
    const m = document.createElement('meta');
    m.name = name;
    m.content = content;
    document.head.append(m);
  }

  document.body.replaceChildren(toolbar, layout);
  root.classList.add('mv-active');

  // ---- Rendering ----
  let headings: HTMLElement[] = [];
  let tocLinks: HTMLAnchorElement[] = [];

  function render(src: string): void {
    const { html, title } = renderMarkdown(src, t('frontMatter'));
    article.innerHTML = html;
    raw.textContent = src;
    addCopyButtons(article);
    renderMath(article).catch((e) => console.warn('[Mark Viewport] math', e));
    diagramsDark = null; // new content: (re)draw diagrams on the next applySettings
    document.title = title ?? fileName();
    buildToc();
    applySettings();
  }

  function buildToc(): void {
    headings = Array.from(article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]'));
    tocLinks = [];
    const list = el('ul');
    for (const h of headings) {
      const clone = h.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.mv-anchor').forEach((a) => a.remove());
      const a = el('a', undefined, clone.textContent?.trim() ?? '');
      a.href = `#${encodeURIComponent(h.id)}`;
      const li = el('li', `mv-toc-${h.tagName.toLowerCase()}`);
      li.append(a);
      list.append(li);
      tocLinks.push(a);
    }
    tocNav.replaceChildren(list);
    updateActive();
  }

  let ticking = false;
  function updateActive(): void {
    ticking = false;
    let idx = -1;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top <= 80) idx = i;
      else break;
    }
    tocLinks.forEach((a, i) => a.classList.toggle('mv-current', i === idx));
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActive);
      }
    },
    { passive: true },
  );

  // ---- Settings ----
  // TOC visibility: starts from the setting (closed on narrow screens, where it
  // overlays the text) and then follows the toolbar button.
  let tocOpen: boolean | null = null;

  // Mermaid colors are baked into the SVG, so diagrams are redrawn when the
  // effective (light/dark) theme changes.
  let diagramsDark: boolean | null = null;
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  function updateDiagrams(): void {
    if (!settings) return;
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && darkQuery.matches);
    if (dark === diagramsDark) return;
    diagramsDark = dark;
    renderMermaid(article, dark).catch((e) => console.warn('[Mark Viewport] mermaid', e));
  }
  darkQuery.addEventListener('change', updateDiagrams);

  function applySettings(): void {
    if (!settings) return;
    updateDiagrams();
    root.dataset.mvTheme = settings.theme;
    root.dataset.mvWidth = settings.width;
    root.style.setProperty('--mv-font-size', `${settings.fontSize}px`);
    if (tocOpen === null) tocOpen = settings.toc && matchMedia('(min-width: 901px)').matches;
    root.classList.toggle('mv-toc-on', tocOpen && headings.length > 0);
    tocBtn.hidden = headings.length === 0;
  }

  // ---- Raw toggle ----
  function toggleRaw(): void {
    const on = root.classList.toggle('mv-show-raw');
    rawBtn.textContent = on ? t('showRendered') : t('showSource');
  }
  rawBtn.addEventListener('click', toggleRaw);
  tocBtn.addEventListener('click', () => {
    tocOpen = !root.classList.contains('mv-toc-on');
    root.classList.toggle('mv-toc-on', tocOpen);
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'toggle-raw') toggleRaw();
  });

  // On narrow screens the TOC is an overlay: close it after picking an entry.
  tocNav.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a') && !matchMedia('(min-width: 901px)').matches) {
      tocOpen = false;
      root.classList.remove('mv-toc-on');
    }
  });


  // ---- Auto reload (local files only) ----
  // Reading a file:// URL with fetch/XHR is refused by Chrome (from both the
  // page and the service worker). Instead, load the same file into a hidden
  // iframe: that is an ordinary navigation, and this content script runs in
  // the frame too and posts the text back (see the probe handling below).
  let timer: number | undefined;
  let inFlight = false;
  let failures = 0;
  let probeSeq = 0;

  function readSelf(): Promise<string | null> {
    return new Promise((resolve) => {
      // A fresh iframe per read: re-navigating an existing one would add a
      // session-history entry each time and break the Back button.
      const id = `${++probeSeq}`;
      const url = new URL(location.href);
      url.hash = '';
      url.searchParams.set(PROBE_PARAM, id);
      const frame = el('iframe', 'mv-probe');
      frame.hidden = true;
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      frame.src = url.href;
      const done = (text: string | null) => {
        clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        frame.remove();
        resolve(text);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow || e.data?.type !== PROBE_MESSAGE || e.data.id !== id) return;
        done(typeof e.data.text === 'string' ? e.data.text : null);
      };
      const timeout = window.setTimeout(() => done(null), 5000);
      window.addEventListener('message', onMessage);
      document.body.append(frame);
    });
  }

  async function poll(): Promise<void> {
    if (inFlight || document.visibilityState !== 'visible') return;
    inFlight = true;
    try {
      const text = await readSelf();
      root.dataset.mvReload = text == null ? 'failed' : 'ok'; // for diagnostics and the e2e test
      if (text == null) {
        // e.g. the file was deleted or renamed. Give up after a few tries.
        if (++failures >= 3) {
          console.info('[Mark Viewport] Auto-reload stopped: the file could not be read.');
          updateReload();
        }
        return;
      }
      failures = 0;
      if (text !== current) {
        current = text;
        render(text);
      }
    } finally {
      inFlight = false;
    }
  }

  function updateReload(): void {
    const want = location.protocol === 'file:' && !!settings?.autoReload && failures < 3;
    if (want && timer === undefined) timer = window.setInterval(poll, RELOAD_INTERVAL_MS);
    if (!want && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  // ---- Boot ----
  render(source);
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView();
  }

  loadSettings().then((s) => {
    settings = s;
    applySettings();
    updateReload();
  });
  onSettingsChanged((s) => {
    if (settings && s.toc !== settings.toc) tocOpen = s.toc;
    settings = s;
    applySettings();
    updateReload();
  });

  chrome.runtime.sendMessage({ type: 'rendered' }).catch(() => {});
}

if (window !== window.top) {
  // Frames are never rendered. The only frame we act in is our own auto-reload
  // probe (a hidden iframe of the same file): hand its text to the parent.
  const id = new URLSearchParams(location.search).get(PROBE_PARAM);
  if (id && location.protocol === 'file:' && MARKDOWN_TYPES.includes(document.contentType)) {
    const pre = document.body?.querySelector(':scope > pre');
    const text = pre ? pre.textContent ?? '' : document.body?.innerText ?? '';
    window.parent.postMessage({ type: PROBE_MESSAGE, id, text }, '*');
  }
} else if (!window.__markViewportLoaded) {
  const source = extractSource();
  if (source != null) {
    window.__markViewportLoaded = true;
    main(source);
  }
}
