export type StoredStartPoint = {
  lat: number;
  lng: number;
  label: string;
};

const PREFIX = 'travelhub-loc-start:';

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Persist a map-picked (or resolved) starting point for a location-info entry. */
export function loadLocationStartPoint(entryId: string): StoredStartPoint | null {
  if (typeof window === 'undefined' || !entryId) return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${entryId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStartPoint;
    if (!isValid(Number(parsed.lat), Number(parsed.lng))) return null;
    return {
      lat: Number(parsed.lat),
      lng: Number(parsed.lng),
      label: (parsed.label || '').trim() || 'Selected point'
    };
  } catch {
    return null;
  }
}

export function saveLocationStartPoint(entryId: string, point: StoredStartPoint | null): void {
  if (typeof window === 'undefined' || !entryId) return;
  try {
    const key = `${PREFIX}${entryId}`;
    if (!point || !isValid(point.lat, point.lng)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(
      key,
      JSON.stringify({
        lat: point.lat,
        lng: point.lng,
        label: (point.label || '').trim() || 'Selected point'
      })
    );
  } catch {
    // private mode / quota
  }
}
