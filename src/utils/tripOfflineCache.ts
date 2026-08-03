/**
 * One overwrite-per-trip offline snapshot (IndexedDB).
 * Never accumulates versions — put() replaces the same tripId key.
 */

import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { JournalEntry } from '../models/JournalEntry';
import type { JournalPhoto } from '../models/JournalPhoto';

const DB_NAME = 'travel-hub-offline';
const DB_VERSION = 1;
const STORE_NAME = 'tripSnapshots';

export interface TripOfflineSnapshot {
  version: 1;
  tripId: string;
  savedAt: string;
  trip: Trip;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  journalEntries?: JournalEntry[];
  journalPhotos?: JournalPhoto[];
  journalCommentCounts?: Record<string, number>;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'tripId' });
      }
    };
  });
}

export async function loadTripOfflineCache(tripId: string): Promise<TripOfflineSnapshot | null> {
  const id = (tripId || '').trim();
  if (!id || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        const row = req.result as TripOfflineSnapshot | undefined;
        resolve(row && row.version === 1 ? row : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveTripOfflineCache(snapshot: TripOfflineSnapshot): Promise<void> {
  const id = (snapshot.tripId || '').trim();
  if (!id || typeof indexedDB === 'undefined') return;
  const payload: TripOfflineSnapshot = {
    ...snapshot,
    version: 1,
    tripId: id,
    savedAt: snapshot.savedAt || new Date().toISOString()
  };
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(payload);
    });
  } catch {
    // Quota / private mode — ignore; online path still works
  }
}

/** Merge journal slice into existing trip snapshot (or no-op if none). */
export async function patchTripOfflineJournalCache(
  tripId: string,
  journal: {
    journalEntries: JournalEntry[];
    journalPhotos: JournalPhoto[];
    journalCommentCounts: Record<string, number>;
  }
): Promise<void> {
  const existing = await loadTripOfflineCache(tripId);
  if (!existing) return;
  await saveTripOfflineCache({
    ...existing,
    savedAt: new Date().toISOString(),
    journalEntries: journal.journalEntries,
    journalPhotos: journal.journalPhotos,
    journalCommentCounts: journal.journalCommentCounts
  });
}

let debounceTimer: number | undefined;
let pendingSnapshot: TripOfflineSnapshot | undefined;

/** Debounced overwrite — coalesces rapid saves without blocking the UI. */
export function scheduleTripOfflineCacheWrite(snapshot: Omit<TripOfflineSnapshot, 'version' | 'savedAt'> & { savedAt?: string }): void {
  pendingSnapshot = {
    version: 1,
    savedAt: snapshot.savedAt || new Date().toISOString(),
    ...snapshot
  };
  if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    const next = pendingSnapshot;
    pendingSnapshot = undefined;
    debounceTimer = undefined;
    if (!next) return;
    void saveTripOfflineCache(next);
  }, 1200);
}

export function flushTripOfflineCacheWrite(): void {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  const next = pendingSnapshot;
  pendingSnapshot = undefined;
  if (next) void saveTripOfflineCache(next);
}
