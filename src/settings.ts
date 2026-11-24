export type Theme = 'auto' | 'light' | 'dark';
export type Width = 'normal' | 'wide' | 'full';

export interface Settings {
  theme: Theme;
  width: Width;
  fontSize: number;
  toc: boolean;
  autoReload: boolean;
}

export const DEFAULTS: Settings = {
  theme: 'auto',
  width: 'normal',
  fontSize: 16,
  toc: true,
  autoReload: true,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULTS as unknown as Record<string, unknown>);
  return { ...DEFAULTS, ...(stored as Partial<Settings>) };
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(patch);
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') loadSettings().then(cb);
  });
}

export function t(key: string): string {
  return chrome.i18n.getMessage(key) || key;
}
