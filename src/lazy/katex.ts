// Lazily imported by the content script only when a page contains math.
import katex from 'katex';

export function renderMath(el: HTMLElement, tex: string, displayMode: boolean): void {
  katex.render(tex, el, { displayMode, throwOnError: false, output: 'htmlAndMathml' });
}
