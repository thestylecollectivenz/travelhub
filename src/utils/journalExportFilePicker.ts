const DB_NAME = 'travel-hub-journal-export';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const FOLDER_KEY = 'pdf-folder';
const PICKER_ID = 'travel-hub-journal-export';

type WellKnownDir = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

type StartIn = FileSystemHandle | WellKnownDir;

interface OpenFilePickerOptions {
  id?: string;
  startIn?: StartIn;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  multiple?: boolean;
}

interface SaveFilePickerOptions {
  id?: string;
  startIn?: StartIn;
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}

interface DirectoryPickerOptions {
  id?: string;
  startIn?: StartIn;
}

interface FileSystemHandleWithParent extends FileSystemHandle {
  getParent?: () => Promise<FileSystemDirectoryHandle>;
}

interface FileSystemHandleWithPermission extends FileSystemHandle {
  queryPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }
}

const PDF_PICKER_TYPES = [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }];

function openExportDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function loadExportDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openExportDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(FOLDER_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveExportDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openExportDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(handle, FOLDER_KEY);
  });
}

async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const fsHandle = handle as unknown as FileSystemHandleWithPermission;
  const opts = { mode: 'read' as const };
  if (typeof fsHandle.queryPermission !== 'function') {
    return false;
  }
  if ((await fsHandle.queryPermission(opts)) === 'granted') {
    return true;
  }
  if (typeof fsHandle.requestPermission !== 'function') {
    return false;
  }
  return (await fsHandle.requestPermission(opts)) === 'granted';
}

async function resolveExportStartIn(): Promise<StartIn> {
  const stored = await loadExportDirectoryHandle();
  if (stored && (await ensureReadPermission(stored))) {
    return stored;
  }
  return 'downloads';
}

async function persistDirectoryFromFileHandle(fileHandle: FileSystemFileHandle): Promise<void> {
  const withParent = fileHandle as FileSystemFileHandle & FileSystemHandleWithParent;
  if (typeof withParent.getParent !== 'function') {
    return;
  }
  try {
    const parent = await withParent.getParent();
    await saveExportDirectoryHandle(parent);
  } catch {
    // Ignore — parent may be unavailable on older browsers.
  }
}

export function supportsJournalExportFolderPicker(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

/** Human-readable label for where Step 2 will open (saved folder name or Downloads). */
export async function getExportFolderLabel(): Promise<string> {
  const stored = await loadExportDirectoryHandle();
  if (stored && (await ensureReadPermission(stored))) {
    return stored.name;
  }
  return 'Downloads';
}

/** Pick a PDF via the File System Access API; returns null if unsupported, cancelled, or on fallback. */
export async function pickJournalPdfFile(): Promise<File | null> {
  if (!window.showOpenFilePicker) {
    return null;
  }

  const startIn = await resolveExportStartIn();
  try {
    const [handle] = await window.showOpenFilePicker({
      id: PICKER_ID,
      startIn,
      multiple: false,
      types: PDF_PICKER_TYPES
    });
    await persistDirectoryFromFileHandle(handle);
    return await handle.getFile();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

/** Let the user choose which folder Step 2 should open in (e.g. match Step 1 save location). */
export async function chooseJournalExportFolder(): Promise<string | null> {
  if (!window.showDirectoryPicker) {
    return null;
  }

  const startIn = await resolveExportStartIn();
  try {
    const dir = await window.showDirectoryPicker({ id: PICKER_ID, startIn });
    await saveExportDirectoryHandle(dir);
    return dir.name;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

/** Save stamped PDF; uses native save picker when available and remembers the folder. */
export async function saveStampedJournalPdf(bytes: Uint8Array, fileName: string): Promise<void> {
  if (!window.showSaveFilePicker) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const startIn = await resolveExportStartIn();
  try {
    const handle = await window.showSaveFilePicker({
      id: PICKER_ID,
      startIn,
      suggestedName: fileName,
      types: PDF_PICKER_TYPES
    });
    await persistDirectoryFromFileHandle(handle);
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    throw err;
  }
}
