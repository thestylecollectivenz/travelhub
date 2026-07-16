import type { LocationInfoNotes } from './locationInfoEntry';
import type { StoredStartPoint } from './locationStartPointStorage';
import { startPointKey } from './locationStartPointStorage';

export type LocationSavedStartPoint = {
  lat: number;
  lng: number;
  label: string;
};

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function normaliseSavedStartPoint(point: {
  lat?: number;
  lng?: number;
  label?: string;
}): LocationSavedStartPoint | null {
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!isValid(lat, lng)) return null;
  return {
    lat,
    lng,
    label: (point.label || '').trim() || 'Selected point'
  };
}

export function migrateSavedStartingPoints(raw: unknown): LocationSavedStartPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: LocationSavedStartPoint[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const n = normaliseSavedStartPoint(row as LocationSavedStartPoint);
    if (!n) continue;
    const key = startPointKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** All nearLabel values currently used by saved dining / nearest places. */
export function nearLabelsInUse(notes: LocationInfoNotes): Set<string> {
  const labels = new Set<string>();
  for (const row of notes.diningSuggestions ?? []) {
    const t = (row.nearLabel || '').trim();
    if (t) labels.add(t.toLowerCase());
  }
  for (const rows of Object.values(notes.nearestPlaces ?? {})) {
    for (const row of rows || []) {
      const t = (row.nearLabel || '').trim();
      if (t) labels.add(t.toLowerCase());
    }
  }
  return labels;
}

export function startPointHasSavedPlaces(notes: LocationInfoNotes, point: StoredStartPoint): boolean {
  const label = (point.label || '').trim().toLowerCase();
  if (!label) return false;
  return nearLabelsInUse(notes).has(label);
}

/** Upsert a start into trip-shared Location Info notes (SharePoint). */
export function upsertSharedStartingPoint(
  notes: LocationInfoNotes,
  point: StoredStartPoint
): LocationInfoNotes {
  const n = normaliseSavedStartPoint(point);
  if (!n) return notes;
  const key = startPointKey(n);
  const existing = migrateSavedStartingPoints(notes.savedStartingPoints);
  const next = [n, ...existing.filter((p) => startPointKey(p) !== key)];
  return {
    ...notes,
    savedStartingPoints: next
  };
}

export function removeSharedStartingPoint(
  notes: LocationInfoNotes,
  point: StoredStartPoint
): LocationInfoNotes {
  const key = startPointKey(point);
  const next = migrateSavedStartingPoints(notes.savedStartingPoints).filter((p) => startPointKey(p) !== key);
  return {
    ...notes,
    savedStartingPoints: next
  };
}

/**
 * Merge SharePoint shared starts with device-local starts.
 * Shared (trip) starts come first so all travellers see the same anchors.
 */
export function mergeSharedAndLocalStarts(
  shared: LocationSavedStartPoint[] | undefined,
  local: StoredStartPoint[]
): StoredStartPoint[] {
  const out: StoredStartPoint[] = [];
  const seen = new Set<string>();
  const push = (p: StoredStartPoint | null | undefined): void => {
    if (!p) return;
    const n = normaliseSavedStartPoint(p);
    if (!n) return;
    const key = startPointKey(n);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };
  for (const p of migrateSavedStartingPoints(shared)) push(p);
  for (const p of local) push(p);
  return out;
}

/**
 * Ensure any local starts that already have saved places are promoted into SharePoint notes.
 */
export function promoteAttachedLocalStarts(
  notes: LocationInfoNotes,
  local: StoredStartPoint[]
): LocationInfoNotes {
  let next = notes;
  for (const p of local) {
    if (startPointHasSavedPlaces(next, p)) {
      next = upsertSharedStartingPoint(next, p);
    }
  }
  return next;
}
