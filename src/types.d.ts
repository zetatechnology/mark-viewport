declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';
  const plugin: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean }) => void;
  export default plugin;
}

declare module 'markdown-it-emoji' {
  import type MarkdownIt from 'markdown-it';
  type Plugin = (md: MarkdownIt, options?: { defs?: Record<string, string>; enabled?: string[]; shortcuts?: Record<string, string | string[]> }) => void;
  export const full: Plugin;
  export const light: Plugin;
  export const bare: Plugin;
}
