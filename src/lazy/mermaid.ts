// Lazily imported by the content script (as an ES module from lazy/) only when
// a page contains ```mermaid blocks, so ordinary pages never pay for it.
import mermaid from 'mermaid';

let theme: string | null = null;
let seq = 0;

export async function renderDiagram(source: string, dark: boolean): Promise<string> {
  const want = dark ? 'dark' : 'default';
  if (theme !== want) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: want });
    theme = want;
  }
  const { svg } = await mermaid.render(`mv-mermaid-${++seq}`, source);
  return svg;
}
