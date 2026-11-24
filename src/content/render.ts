import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { full as emoji } from 'markdown-it-emoji';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';
import { alerts, fences, math } from './plugins';

// GitHub-like slug: lowercase, drop punctuation, spaces -> hyphens. Keeps CJK.
export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
  highlight(code, lang) {
    const language = lang.trim().split(/\s+/)[0]?.toLowerCase();
    if (language && hljs.getLanguage(language)) {
      try {
        const out = hljs.highlight(code, { language, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code class="language-${escapeHtml(language)}">${out}</code></pre>`;
      } catch {
        /* fall through to default rendering */
      }
    }
    return '';
  },
})
  .use(anchor, {
    slugify,
    level: [1, 2, 3, 4, 5, 6],
    permalink: anchor.permalink.ariaHidden({ placement: 'before', symbol: '#', class: 'mv-anchor' }),
  })
  .use(footnote)
  .use(taskLists, { enabled: false, label: true })
  // GitHub converts :shortcodes: but not ASCII smileys like :) or :-(
  .use(emoji, { shortcuts: {} })
  .use(math)
  .use(fences)
  .use(alerts);

const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export interface Rendered {
  html: string;
  title: string | null;
}

export function renderMarkdown(source: string, frontMatterLabel: string): Rendered {
  let body = source.replace(/^﻿/, '');
  let prefix = '';
  const fm = FRONT_MATTER.exec(body);
  if (fm) {
    body = body.slice(fm[0].length);
    prefix = `<details class="mv-frontmatter"><summary>${escapeHtml(frontMatterLabel)}</summary><pre><code>${escapeHtml(fm[1])}</code></pre></details>`;
  }

  const dirty = prefix + md.render(body);
  const html = DOMPurify.sanitize(dirty, {
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form'],
  });

  const h1 = /^#\s+(.+)$/m.exec(body);
  return { html, title: h1 ? h1[1].replace(/[`*_]/g, '').trim() : null };
}
