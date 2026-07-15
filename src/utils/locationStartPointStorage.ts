export type StoredStartPoint = {
  lat: number;
  lng: number;
  label: string;
};

const CURRENT_PREFIX = 'travelhub-loc-start:';
const LIST_PREFIX = 'travelhub-loc-starts:';
const MAX_SAVED = 12;

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function normalise(point: StoredStartPoint): StoredStartPoint | null {
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!isValid(lat, lng)) return null;
  return {
    lat,
    lng,
    label: (point.label || '').trim() || 'Selected point'
  };
}

export function startPointKey(point: Pick<StoredStartPoint, 'lat' | 'lng'>): string {
  return `${Number(point.lat).toFixed(4)},${Number(point.lng).toFixed(4)}`;
}

/** Persist a map-picked (or resolved) starting point for a location-info entry. */
export function loadLocationStartPoint(entryId: string): StoredStartPoint | null {
  if (typeof window === 'undefined' || !entryId) return null;
  try {
    const raw = window.localStorage.getItem(`${CURRENT_PREFIX}${entryId}`);
    if (!raw) return null;
    return normalise(JSON.parse(raw) as StoredStartPoint);
  } catch {
    return null;
  }
}

export function saveLocationStartPoint(entryId: string, point: StoredStartPoint | null): void {
  if (typeof window === 'undefined' || !entryId) return;
  try {
    const key = `${CURRENT_PREFIX}${entryId}`;
    if (!point) {
      window.localStorage.removeItem(key);
      return;
    }
    const normalised = normalise(point);
    if (!normalised) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(normalised));
    rememberLocationStartPoint(entryId, normalised);
  } catch {
    // private mode / quota
  }
}

/** Previously used custom starting points for this location (newest first). */
export function loadLocationStartPointList(entryId: string): StoredStartPoint[] {
  if (typeof window === 'undefined' || !entryId) return [];
  try {
    const raw = window.localStorage.getItem(`${LIST_PREFIX}${entryId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredStartPoint[];
    if (!Array.isArray(parsed)) return [];
    const out: StoredStartPoint[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      const n = normalise(row);
      if (!n) continue;
      const key = startPointKey(n);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

/** Remember a starting point so it can be re-selected later (like “Near accommodation”). */
export function rememberLocationStartPoint(entryId: string, point: StoredStartPoint): void {
  if (typeof window === 'undefined' || !entryId) return;
  const normalised = normalise(point);
  if (!normalised) return;
  try {
    const existing = loadLocationStartPointList(entryId);
    const key = startPointKey(normalised);
    const next = [normalised, ...existing.filter((p) => startPointKey(p) !== key)].slice(0, MAX_SAVED);
    window.localStorage.setItem(`${LIST_PREFIX}${entryId}`, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
}
