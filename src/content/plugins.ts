// markdown-it plugins for GitHub-flavored extras: math, alerts, and diagram fences.
// Math and Mermaid are only marked up here (source kept as escaped text); the
// heavy renderers are loaded lazily by the content script when they are needed.
import type { MarkdownIt, StateBlock, StateCore, StateInline } from 'markdown-it';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const mathInline = (tex: string) => `<span class="mv-math">${esc(tex)}</span>`;
const mathBlock = (tex: string) => `<div class="mv-math mv-math-block">${esc(tex)}</div>\n`;

// ---------- Math: $...$, $$...$$, ```math ----------
export function math(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', (state: StateInline, silent: boolean) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== 0x24 /* $ */) return false;

    const display = src.charCodeAt(start + 1) === 0x24;
    const open = display ? 2 : 1;
    const first = src[start + open];
    if (first === undefined || /\s/.test(first) || (!display && first === '$')) return false;

    let end = start + open;
    for (;;) {
      end = src.indexOf(display ? '$$' : '$', end);
      if (end === -1) return false;
      let bs = 0;
      for (let i = end - 1; src[i] === '\\'; i--) bs++;
      const escaped = bs % 2 === 1;
      const okClose = display || (!/\s/.test(src[end - 1]) && !/\d/.test(src[end + 1] ?? ''));
      if (!escaped && okClose) break;
      end++;
    }

    if (!silent) {
      const token = state.push('math_inline', 'span', 0);
      token.content = src.slice(start + open, end);
      token.meta = { display };
    }
    state.pos = end + open;
    return true;
  });

  md.block.ruler.before(
    'fence',
    'math_block',
    (state: StateBlock, startLine: number, endLine: number, silent: boolean) => {
      let pos = state.bMarks[startLine] + state.tShift[startLine];
      let max = state.eMarks[startLine];
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') return false;
      if (silent) return true;

      pos += 2;
      let firstLine = state.src.slice(pos, max);
      let content: string;
      let next = startLine;

      if (firstLine.trim().endsWith('$$')) {
        // Single line: $$ ... $$
        content = firstLine.trim().slice(0, -2);
      } else {
        const lines = [firstLine];
        let found = false;
        while (++next < endLine) {
          pos = state.bMarks[next] + state.tShift[next];
          max = state.eMarks[next];
          if (pos < max && state.sCount[next] < state.blkIndent) break;
          const line = state.src.slice(pos, max);
          if (line.trim().endsWith('$$')) {
            lines.push(line.trim().slice(0, -2));
            found = true;
            break;
          }
          lines.push(state.src.slice(state.bMarks[next], max));
        }
        if (!found) return false;
        content = lines.join('\n');
      }

      state.line = next + 1;
      const token = state.push('math_block', 'div', 0);
      token.block = true;
      token.content = content.trim();
      token.map = [startLine, state.line];
      token.markup = '$$';
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );

  md.renderer.rules.math_inline = (tokens, idx) => {
    const t = tokens[idx];
    // $$...$$ inside a paragraph: a <div> would break the <p>, so use a block-styled span.
    return t.meta?.display ? `<span class="mv-math mv-math-block">${esc(t.content)}</span>` : mathInline(t.content);
  };
  md.renderer.rules.math_block = (tokens, idx) => mathBlock(tokens[idx].content);
}

// ---------- Special fences: ```mermaid, ```math ----------
export function fences(md: MarkdownIt): void {
  const base = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const lang = tokens[idx].info.trim().split(/\s+/)[0]?.toLowerCase();
    const code = tokens[idx].content;
    if (lang === 'mermaid') return `<pre class="mv-mermaid">${esc(code)}</pre>\n`;
    if (lang === 'math') return mathBlock(code.trim());
    return base(tokens, idx, options, env, self);
  };
}

// ---------- GitHub alerts: > [!NOTE] ----------
const ALERT_ICONS: Record<string, string> = {
  note: '<circle cx="8" cy="8" r="6.25"/><path d="M8 7.25v4M8 4.75v.01"/>',
  tip: '<path d="M5.5 10.5C4.3 9.6 3.5 8.2 3.5 6.6a4.5 4.5 0 0 1 9 0c0 1.6-.8 3-2 3.9v1.25h-5z"/><path d="M6 14h4"/>',
  important: '<path d="M2.25 2.75h11.5v8.5h-6.5l-3 2.5v-2.5h-2z"/><path d="M8 5v3M8 9.75v.01"/>',
  warning: '<path d="M8 1.75 14.75 13.5H1.25z"/><path d="M8 6v3.5M8 11.5v.01"/>',
  caution: '<path d="M5.25 1.75h5.5l3.5 3.5v5.5l-3.5 3.5h-5.5l-3.5-3.5v-5.5z"/><path d="M8 4.75v4M8 11v.01"/>',
};
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

export function alerts(md: MarkdownIt): void {
  md.core.ruler.after('block', 'github_alerts', (state: StateCore) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const para = tokens[i + 1];
      const inline = tokens[i + 2];
      if (para.type !== 'paragraph_open' || inline.type !== 'inline') continue;
      const m = ALERT_RE.exec(inline.content);
      if (!m) continue;

      const kind = m[1].toLowerCase();
      // Find the matching close tag (blockquotes can nest).
      let depth = 0;
      let close = -1;
      for (let j = i; j < tokens.length; j++) {
        if (tokens[j].type === 'blockquote_open') depth++;
        else if (tokens[j].type === 'blockquote_close' && --depth === 0) {
          close = j;
          break;
        }
      }
      if (close === -1) continue;

      tokens[i].tag = tokens[close].tag = 'div';
      tokens[i].attrSet('class', `markdown-alert markdown-alert-${kind}`);

      inline.content = inline.content.slice(m[0].length);
      const removeEmptyPara = inline.content.trim() === '';
      const title = new state.Token('html_block', '', 0);
      title.content =
        `<p class="markdown-alert-title"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">` +
        `${ALERT_ICONS[kind]}</svg>${kind[0].toUpperCase()}${kind.slice(1)}</p>\n`;
      tokens.splice(i + 1, removeEmptyPara ? 3 : 0, title);
    }
  });
}
