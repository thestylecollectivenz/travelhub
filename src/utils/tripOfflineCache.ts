/**
 * Offline read cache (IndexedDB).
 * - One overwrite-per-trip snapshot (never accumulates versions).
 * - Separate home trips index so the trip list works offline.
 * Writes merge with any existing row so journal/extras are not wiped by core updates.
 */

import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { JournalEntry } from '../models/JournalEntry';
import type { JournalPhoto } from '../models/JournalPhoto';
import type { Place } from '../models/Place';
import type { EntryDocument } from '../models/EntryDocument';
import type { EntryLink } from '../models/EntryLink';
import type { PackingItem } from '../services/PackingService';
import type { ShoppingItem } from '../services/ShoppingListService';
import type { TripReminder } from '../services/ReminderService';

const DB_NAME = 'travel-hub-offline';
const DB_VERSION = 2;
const TRIP_STORE = 'tripSnapshots';
const INDEX_STORE = 'tripsIndex';
const INDEX_KEY = 'home';

export interface TripOfflineSnapshot {
  version: 1 | 2;
  tripId: string;
  savedAt: string;
  trip: Trip;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  journalEntries?: JournalEntry[];
  journalPhotos?: JournalPhoto[];
  journalCommentCounts?: Record<string, number>;
  packingItems?: PackingItem[];
  shoppingItems?: ShoppingItem[];
  reminders?: TripReminder[];
  places?: Place[];
  documents?: EntryDocument[];
  links?: EntryLink[];
}

export interface TripsIndexPlaceRow {
  id: string;
  title: string;
  lat: number;
  lon: number;
  countryCode: string;
  country: string;
}

export interface TripsIndexSnapshot {
  version: 1;
  key: typeof INDEX_KEY;
  savedAt: string;
  trips: Trip[];
  places: TripsIndexPlaceRow[];
  tripDays: Array<{ tripId: string; primaryPlaceId?: string }>;
}

export type TripOfflineExtrasPatch = Partial<
  Pick<
    TripOfflineSnapshot,
    | 'journalEntries'
    | 'journalPhotos'
    | 'journalCommentCounts'
    | 'packingItems'
    | 'shoppingItems'
    | 'reminders'
    | 'places'
    | 'documents'
    | 'links'
  >
>;

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRIP_STORE)) {
        db.createObjectStore(TRIP_STORE, { keyPath: 'tripId' });
      }
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        db.createObjectStore(INDEX_STORE, { keyPath: 'key' });
      }
    };
  });
}

function isUsableSnapshot(row: TripOfflineSnapshot | undefined): row is TripOfflineSnapshot {
  return Boolean(row && (row.version === 1 || row.version === 2) && row.tripId && row.trip);
}

export async function loadTripOfflineCache(tripId: string): Promise<TripOfflineSnapshot | null> {
  const id = (tripId || '').trim();
  if (!id || typeof indexedDB === 'undefined') return null;
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TRIP_STORE, 'readonly');
      const req = tx.objectStore(TRIP_STORE).get(id);
      req.onsuccess = () => {
        const row = req.result as TripOfflineSnapshot | undefined;
        resolve(isUsableSnapshot(row) ? row : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Merge-aware put — preserves extras/journal when the incoming slice omits them. */
export async function saveTripOfflineCache(
  snapshot: Omit<TripOfflineSnapshot, 'version' | 'savedAt'> & { version?: 1 | 2; savedAt?: string }
): Promise<void> {
  const id = (snapshot.tripId || '').trim();
  if (!id || typeof indexedDB === 'undefined') return;
  const existing = await loadTripOfflineCache(id);
  const payload: TripOfflineSnapshot = {
    version: 2,
    tripId: id,
    savedAt: snapshot.savedAt || new Date().toISOString(),
    trip: snapshot.trip,
    tripDays: snapshot.tripDays,
    entries: snapshot.entries,
    journalEntries: snapshot.journalEntries ?? existing?.journalEntries,
    journalPhotos: snapshot.journalPhotos ?? existing?.journalPhotos,
    journalCommentCounts: snapshot.journalCommentCounts ?? existing?.journalCommentCounts,
    packingItems: snapshot.packingItems ?? existing?.packingItems,
    shoppingItems: snapshot.shoppingItems ?? existing?.shoppingItems,
    reminders: snapshot.reminders ?? existing?.reminders,
    places: snapshot.places ?? existing?.places,
    documents: snapshot.documents ?? existing?.documents,
    links: snapshot.links ?? existing?.links
  };
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TRIP_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(TRIP_STORE).put(payload);
    });
  } catch {
    // Quota / private mode — ignore; online path still works
  }
}

export async function patchTripOfflineExtrasCache(tripId: string, patch: TripOfflineExtrasPatch): Promise<void> {
  const existing = await loadTripOfflineCache(tripId);
  if (!existing) return;
  await saveTripOfflineCache({
    ...existing,
    ...patch,
    savedAt: new Date().toISOString()
  });
}

/** @deprecated Prefer patchTripOfflineExtrasCache — kept for call-site compatibility. */
export async function patchTripOfflineJournalCache(
  tripId: string,
  journal: {
    journalEntries: JournalEntry[];
    journalPhotos: JournalPhoto[];
    journalCommentCounts: Record<string, number>;
  }
): Promise<void> {
  await patchTripOfflineExtrasCache(tripId, journal);
}

export async function saveTripsIndexCache(
  data: Omit<TripsIndexSnapshot, 'version' | 'key' | 'savedAt'> & { savedAt?: string }
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const payload: TripsIndexSnapshot = {
    version: 1,
    key: INDEX_KEY,
    savedAt: data.savedAt || new Date().toISOString(),
    trips: data.trips,
    places: data.places,
    tripDays: data.tripDays
  };
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(INDEX_STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(INDEX_STORE).put(payload);
    });
  } catch {
    /* ignore */
  }
}

export async function loadTripsIndexCache(): Promise<TripsIndexSnapshot | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(INDEX_STORE, 'readonly');
      const req = tx.objectStore(INDEX_STORE).get(INDEX_KEY);
      req.onsuccess = () => {
        const row = req.result as TripsIndexSnapshot | undefined;
        resolve(row && row.version === 1 && Array.isArray(row.trips) ? row : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** List of trip ids that have a usable full snapshot (for home “open offline”). */
export async function listCachedTripIds(): Promise<string[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openOfflineDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TRIP_STORE, 'readonly');
      const req = tx.objectStore(TRIP_STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

let debounceTimer: number | undefined;
let pendingSnapshot: (Omit<TripOfflineSnapshot, 'version' | 'savedAt'> & { savedAt?: string }) | undefined;

/** Debounced overwrite — coalesces rapid saves without blocking the UI. */
export function scheduleTripOfflineCacheWrite(
  snapshot: Omit<TripOfflineSnapshot, 'version' | 'savedAt'> & { savedAt?: string }
): void {
  pendingSnapshot = {
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
