// Saving edited Markdown back to disk with the File System Access API.
//
// An extension cannot write to a file:// URL directly, so the first save asks
// the user to pick the file (the picker is pre-filled with the current file
// name). The chosen handle is remembered per page URL in IndexedDB, so later
// saves overwrite the same file without asking again (Chrome may still ask to
// confirm write access once per visit).

const DB_NAME = 'mark-viewport';
const STORE = 'file-handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** IndexedDB can be unavailable (e.g. opaque origins); the handle then lives for this page only. */
async function loadHandle(key: string): Promise<FileSystemFileHandle | null> {
  try {
    return ((await withStore('readonly', (s) => s.get(key))) as FileSystemFileHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

async function storeHandle(key: string, handle: FileSystemFileHandle | null): Promise<void> {
  try {
    await withStore<unknown>('readwrite', (s) => (handle ? s.put(handle, key) : s.delete(key)) as IDBRequest<unknown>);
  } catch {
    /* not persisted: fine */
  }
}

async function canWrite(handle: FileSystemFileHandle): Promise<boolean> {
  const opts = { mode: 'readwrite' } as const;
  if ((await handle.queryPermission?.(opts)) === 'granted') return true;
  return (await handle.requestPermission?.(opts)) === 'granted';
}

/**
 * `text` uses \n line breaks (the page and the textarea both fold CRLF), so
 * the file's own style is taken from the file on disk: CRLF and a UTF-8 BOM
 * are kept when the file being overwritten has them.
 */
async function matchFileStyle(handle: FileSystemFileHandle, text: string): Promise<string> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await (await handle.getFile()).slice(0, 64 * 1024).arrayBuffer());
  } catch {
    return text; // new or unreadable file: plain \n
  }
  const bom = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  const lf = head.indexOf(0x0a);
  const crlf = lf > 0 && head[lf - 1] === 0x0d;
  return (bom ? '﻿' : '') + (crlf ? text.replace(/\n/g, '\r\n') : text);
}

export const pickerSupported = typeof window.showSaveFilePicker === 'function';

export type SaveResult =
  | { ok: true; name: string; method: 'file' | 'download' }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

export class FileSaver {
  private handle: FileSystemFileHandle | null = null;
  private loaded = false;

  constructor(private readonly key: string, private readonly suggestedName: string) {}

  /** Name of the file saves currently go to, if one was chosen. */
  async target(): Promise<string | null> {
    await this.ensureLoaded();
    return this.handle?.name ?? null;
  }

  async forget(): Promise<void> {
    this.handle = null;
    this.loaded = true;
    await storeHandle(this.key, null);
  }

  /** Must be called from a user gesture (click / key press): it may open a picker or a permission prompt. */
  async save(text: string, opts: { pickNew?: boolean } = {}): Promise<SaveResult> {
    if (!pickerSupported) return this.download(text);
    try {
      await this.ensureLoaded();
      let handle = opts.pickNew ? null : this.handle;
      if (handle && !(await canWrite(handle))) handle = null;
      if (!handle) {
        handle = await window.showSaveFilePicker!({
          suggestedName: this.handle?.name ?? this.suggestedName,
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } }],
        });
      }
      const out = await matchFileStyle(handle, text);
      const w = await handle.createWritable();
      await w.write(out);
      await w.close();
      if (handle !== this.handle) {
        this.handle = handle;
        await storeHandle(this.key, handle);
      }
      return { ok: true, name: handle.name, method: 'file' };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, cancelled: true };
      return { ok: false, cancelled: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    this.handle = await loadHandle(this.key);
  }

  /** Fallback without the File System Access API: download a copy. */
  private download(text: string): SaveResult {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = this.suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { ok: true, name: this.suggestedName, method: 'download' };
  }
}
