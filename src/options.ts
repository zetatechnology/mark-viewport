import { loadSettings, saveSettings, t, type Settings } from './settings';

document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((e) => {
  e.textContent = t(e.dataset.i18n!);
});
document.title = t('optionsTitle');

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const theme = $<HTMLSelectElement>('theme');
const width = $<HTMLSelectElement>('width');
const fontSize = $<HTMLInputElement>('fontSize');
const toc = $<HTMLInputElement>('toc');
const autoReload = $<HTMLInputElement>('autoReload');
const status = $<HTMLDivElement>('status');

let statusTimer: number | undefined;
async function save(patch: Partial<Settings>): Promise<void> {
  await saveSettings(patch);
  status.textContent = t('optSaved');
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (status.textContent = ''), 1500);
}

loadSettings().then((s) => {
  theme.value = s.theme;
  width.value = s.width;
  fontSize.value = String(s.fontSize);
  toc.checked = s.toc;
  autoReload.checked = s.autoReload;
});

theme.addEventListener('change', () => save({ theme: theme.value as Settings['theme'] }));
width.addEventListener('change', () => save({ width: width.value as Settings['width'] }));
fontSize.addEventListener('change', () => {
  const n = Math.min(32, Math.max(10, Math.round(Number(fontSize.value) || 16)));
  fontSize.value = String(n);
  save({ fontSize: n });
});
toc.addEventListener('change', () => save({ toc: toc.checked }));
autoReload.addEventListener('change', () => save({ autoReload: autoReload.checked }));

const fileAccess = $<HTMLParagraphElement>('file-access');
const openDetails = $<HTMLButtonElement>('open-details');
chrome.extension.isAllowedFileSchemeAccess().then((allowed) => {
  fileAccess.textContent = t(allowed ? 'fileAccessOn' : 'fileAccessOff');
  fileAccess.classList.toggle('off', !allowed);
  openDetails.hidden = allowed;
});
openDetails.addEventListener('click', () => {
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});
