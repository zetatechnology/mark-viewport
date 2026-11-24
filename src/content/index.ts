import { renderMarkdown } from './render';
import { addCopyButtons, renderMath, renderMermaid } from './enhance';
import { FileSaver, pickerSupported } from './save';
import { loadSettings, onSettingsChanged, t, type Settings } from '../settings';

const MARKDOWN_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
const RELOAD_INTERVAL_MS = 1000;

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

  const editor = el('textarea', 'mv-editor');
  editor.spellcheck = false;
  editor.setAttribute('aria-label', t('editorLabel'));

  const layout = el('div', 'mv-layout');
  layout.append(toc, editor, main);

  const tocBtn = el('button', 'mv-btn mv-btn-toc', t('toc'));
  tocBtn.type = 'button';
  tocBtn.title = t('toggleToc');
  const rawBtn = el('button', 'mv-btn mv-btn-raw', t('showSource'));
  rawBtn.type = 'button';
  const previewBtn = el('button', 'mv-btn', t('preview'));
  previewBtn.type = 'button';
  previewBtn.title = t('previewTitle');
  previewBtn.hidden = true;
  const editBtn = el('button', 'mv-btn', t('edit'));
  editBtn.type = 'button';
  editBtn.title = t('editTitle');
  const saveBtn = el('button', 'mv-btn mv-btn-primary', t('save'));
  saveBtn.type = 'button';
  saveBtn.title = pickerSupported ? t('saveTitle') : t('saveDownloadTitle');
  saveBtn.hidden = true;
  const status = el('span', 'mv-status');
  status.setAttribute('role', 'status');
  const toolbar = el('div', 'mv-toolbar');
  toolbar.append(status, tocBtn, previewBtn, saveBtn, editBtn, rawBtn);

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
    if (editing) {
      // Toolbar icon while editing: show / hide the preview instead.
      setPreview(!previewing);
      return;
    }
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


  // ---- Editing ----
  // `current` is the file as last read from / written to disk. The textarea
  // normalizes line breaks to \n, so the file's own style is restored on save.
  const saver = new FileSaver(location.href.split('#')[0], fileName());
  let editing = false;
  let eol = /\r\n/.test(source) ? '\r\n' : '\n';
  let saving = false;
  let saveAgain = false;
  let conflict = false;
  let previewing = false;
  let renderedText: string | null = null; // editor text the preview was last rendered from
  const normalize = (s: string) => s.replace(/\r\n?/g, '\n');
  const isDirty = () => normalize(current) !== editor.value;

  function setStatus(text: string, kind: 'info' | 'dirty' | 'ok' | 'error' = 'info'): void {
    status.textContent = text;
    status.dataset.kind = kind;
  }

  /** Status after an edit: unsaved / conflict, or clear when back to the saved text. */
  function refreshStatus(): void {
    if (!editing) setStatus('');
    else if (conflict) setStatus(t('changedOnDisk'), 'error');
    else if (isDirty()) setStatus(t('unsaved'), 'dirty');
    else if (status.dataset.kind === 'dirty') setStatus('');
  }

  function setEditing(on: boolean): void {
    if (on === editing) return;
    if (!on && isDirty() && !confirm(t('discardConfirm'))) return;
    editing = on;
    conflict = false;
    root.classList.remove('mv-show-raw');
    rawBtn.textContent = t('showSource');
    root.classList.toggle('mv-editing', on);
    editBtn.textContent = on ? t('editDone') : t('edit');
    saveBtn.hidden = !on;
    previewBtn.hidden = !on;
    setPreview(false);
    renderedText = null;
    setStatus('');
    if (on) {
      editor.value = normalize(current);
      editor.setSelectionRange(0, 0);
      editor.focus({ preventScroll: true });
      editor.scrollTop = 0;
      main.scrollTop = 0;
      saver.target().then((name) => {
        if (editing && name && !status.textContent) setStatus(t('saveTarget') + name);
      });
    }
    render(current);
  }

  /** Shows the rendered editor text in front of the editor, or goes back to the editor. */
  function setPreview(on: boolean): void {
    on = on && editing;
    if (on === previewing) return;
    previewing = on;
    root.classList.toggle('mv-edit-preview', on);
    previewBtn.textContent = on ? t('backToEditor') : t('preview');
    previewBtn.classList.toggle('mv-btn-active', on);
    if (on) {
      if (renderedText !== editor.value) {
        renderedText = editor.value;
        render(renderedText);
      }
      // Open the preview at about the part being edited.
      const max = editor.scrollHeight - editor.clientHeight;
      const ratio = max > 0 ? editor.scrollTop / max : 0;
      main.scrollTop = ratio * (main.scrollHeight - main.clientHeight);
      main.focus({ preventScroll: true }); // arrow keys / PageDown scroll the preview
    } else if (editing) {
      editor.focus({ preventScroll: true });
    }
  }

  async function save(pickNew = false): Promise<void> {
    if (saving) {
      // Save again once the running save is done (it may have read older text).
      saveAgain = true;
      return;
    }
    saving = true;
    const text = editor.value;
    const out = eol === '\n' ? text : text.replace(/\n/g, eol);
    setStatus(t('saving'));
    let again = false;
    try {
      const res = await saver.save(out, { pickNew });
      if (res.ok) {
        if (res.method === 'file') {
          current = out;
          conflict = false;
        }
        const other = res.method === 'file' && res.name !== fileName() ? ` → ${res.name}` : '';
        setStatus((res.method === 'file' ? t('saved') : t('downloaded')) + other, 'ok');
        if (editor.value !== text) refreshStatus(); // typed while saving
      } else if (res.cancelled) {
        setStatus('');
        refreshStatus();
      } else {
        setStatus(`${t('saveFailed')}: ${res.error}`, 'error');
      }
      again = saveAgain && res.ok && res.method === 'file';
    } finally {
      saving = false;
      saveAgain = false;
    }
    if (again && editing && isDirty()) await save();
  }

  /** The file changed on disk (auto reload). */
  function externalChange(text: string): void {
    if (saving) return;
    if (editing && isDirty()) {
      // Keep the user's edits; saving will overwrite the other change.
      if (!conflict) {
        conflict = true;
        refreshStatus();
      }
      current = text;
      return;
    }
    current = text;
    eol = /\r\n/.test(text) ? '\r\n' : '\n';
    if (editing) {
      const { selectionStart, selectionEnd, scrollTop } = editor;
      editor.value = normalize(text);
      editor.setSelectionRange(selectionStart, selectionEnd);
      editor.scrollTop = scrollTop;
      renderedText = editor.value;
    }
    render(text);
  }

  editBtn.addEventListener('click', () => setEditing(!editing));
  saveBtn.addEventListener('click', (e) => save(e.shiftKey));
  previewBtn.addEventListener('click', () => setPreview(!previewing));
  editor.addEventListener('input', refreshStatus);
  main.tabIndex = -1;

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      // execCommand keeps the native undo stack working.
      document.execCommand('insertText', false, '  ');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewing) {
      e.preventDefault();
      setPreview(false);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'p' && e.shiftKey && editing) {
      e.preventDefault();
      setPreview(!previewing);
    } else if (key === 's' && editing) {
      e.preventDefault();
      save(e.shiftKey);
    } else if (key === 'e' && !e.shiftKey) {
      e.preventDefault();
      setEditing(!editing);
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (editing && isDirty()) e.preventDefault();
  });

  // ---- Auto reload (local files only) ----
  let timer: number | undefined;
  let inFlight = false;

  async function readSelf(): Promise<string | null> {
    const url = location.href.split('#')[0];
    try {
      const res = await chrome.runtime.sendMessage({ type: 'fetch-file', url });
      if (res?.ok) return res.text as string;
    } catch {
      /* extension reloaded or worker unavailable */
    }
    return null;
  }

  async function poll(): Promise<void> {
    if (inFlight || document.visibilityState !== 'visible') return;
    inFlight = true;
    try {
      const text = await readSelf();
      if (text != null && text !== current) externalChange(text);
    } finally {
      inFlight = false;
    }
  }

  function updateReload(): void {
    const want = location.protocol === 'file:' && !!settings?.autoReload;
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

if (!window.__markViewportLoaded) {
  const source = extractSource();
  if (source != null) {
    window.__markViewportLoaded = true;
    main(source);
  }
}
