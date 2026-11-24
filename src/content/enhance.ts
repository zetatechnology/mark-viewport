// DOM post-processing after each render: code copy buttons, math and Mermaid.
// KaTeX and Mermaid are large, so they are separate ES modules under lazy/ that
// are imported only when the document actually contains math or diagrams.
import { t } from '../settings';

type KatexModule = typeof import('../lazy/katex');
type MermaidModule = typeof import('../lazy/mermaid');

const modules = new Map<string, Promise<unknown>>();
function load<T>(name: string): Promise<T> {
  let p = modules.get(name);
  if (!p) {
    p = import(/* @vite-ignore */ chrome.runtime.getURL(`lazy/${name}.js`));
    modules.set(name, p);
  }
  return p as Promise<T>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---------- Copy buttons ----------
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Not a secure context (plain http) or permission denied: legacy fallback.
    const ta = el('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function addCopyButtons(root: HTMLElement): void {
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre')) {
    if (pre.classList.contains('mv-mermaid') || pre.closest('.mv-frontmatter')) continue;
    const code = pre.querySelector('code');
    if (!code) continue;
    const wrap = el('div', 'mv-code');
    pre.replaceWith(wrap);
    const btn = el('button', 'mv-copy', t('copy'));
    btn.type = 'button';
    btn.title = t('copyCode');
    let timer: number | undefined;
    btn.addEventListener('click', async () => {
      const ok = await copyText(code.textContent ?? '');
      btn.textContent = ok ? t('copied') : t('copyFailed');
      btn.classList.toggle('mv-done', ok);
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        btn.textContent = t('copy');
        btn.classList.remove('mv-done');
      }, 1500);
    });
    wrap.append(pre, btn);
  }
}

// ---------- Math ----------
let katexCss = false;
function ensureKatexCss(): void {
  if (katexCss) return;
  katexCss = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('lazy/katex/katex.min.css');
  document.head.append(link);
}

export async function renderMath(root: HTMLElement): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mv-math'));
  if (nodes.length === 0) return;
  ensureKatexCss();
  const { renderMath } = await load<KatexModule>('katex');
  for (const node of nodes) {
    if (!node.isConnected) continue;
    const tex = node.textContent ?? '';
    try {
      renderMath(node, tex, node.classList.contains('mv-math-block'));
      node.classList.add('mv-math-done');
    } catch {
      node.textContent = tex;
      node.classList.add('mv-math-error');
    }
  }
}

// ---------- Mermaid ----------
const diagramSource = new WeakMap<HTMLElement, string>();

/** Replaces each <pre class="mv-mermaid"> with a diagram container (once per render). */
function collectDiagrams(root: HTMLElement): HTMLElement[] {
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre.mv-mermaid')) {
    if (pre.closest('.mv-diagram')) continue;
    const box = el('div', 'mv-diagram');
    box.append(pre.cloneNode(true)); // shown until the diagram is ready
    diagramSource.set(box, pre.textContent ?? '');
    pre.replaceWith(box);
  }
  return Array.from(root.querySelectorAll<HTMLElement>('.mv-diagram'));
}

let generation = 0;

export async function renderMermaid(root: HTMLElement, dark: boolean): Promise<void> {
  const boxes = collectDiagrams(root);
  if (boxes.length === 0) return;
  const gen = ++generation;
  const { renderDiagram } = await load<MermaidModule>('mermaid');
  // Mermaid keeps global state, so render one diagram at a time.
  for (const box of boxes) {
    if (gen !== generation) return; // a newer render or theme change took over
    if (!box.isConnected) continue;
    const source = diagramSource.get(box) ?? '';
    try {
      const svg = await renderDiagram(source, dark);
      if (gen !== generation) return;
      box.innerHTML = svg;
      box.classList.remove('mv-diagram-error');
    } catch (e) {
      if (gen !== generation) return;
      const msg = el('div', 'mv-diagram-message', `${t('diagramError')}: ${e instanceof Error ? e.message : String(e)}`);
      const pre = el('pre', 'mv-mermaid', source);
      box.replaceChildren(msg, pre);
      box.classList.add('mv-diagram-error');
    }
  }
  // Mermaid can leave its temporary measuring nodes behind after errors.
  document.querySelectorAll('body > [id^="dmv-mermaid-"]').forEach((n) => n.remove());
}
