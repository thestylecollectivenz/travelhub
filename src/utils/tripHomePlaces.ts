import type { Trip } from '../models/Trip';

/**
 * Trip home places are stored on Trips.HomePlaceId as a semicolon-separated
 * list of Place IDs (shared for every traveller on the trip).
 * A single legacy ID (no separator) still parses correctly.
 */
export function parseHomePlaceIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = String(raw).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return uniqueIds(parsed.map((x) => String(x)));
      }
    } catch {
      /* fall through to delimiter parse */
    }
  }
  return uniqueIds(trimmed.split(/[;,|]/));
}

export function serializeHomePlaceIds(ids: string[] | undefined): string {
  return uniqueIds(ids || []).join(';');
}

export function tripHomePlaceIds(trip: Pick<Trip, 'homePlaceIds'> | null | undefined): string[] {
  return trip?.homePlaceIds?.length ? [...trip.homePlaceIds] : [];
}

export function isTripHomePlace(
  trip: Pick<Trip, 'homePlaceIds'> | null | undefined,
  placeId: string | undefined
): boolean {
  const id = (placeId || '').trim();
  return id ? tripHomePlaceIds(trip).includes(id) : false;
}

/** Add or remove a place from the trip home set. */
export function toggleTripHomePlaceId(current: string[] | undefined, placeId: string): string[] {
  const id = placeId.trim();
  if (!id) return uniqueIds(current || []);
  const next = new Set(uniqueIds(current || []));
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return Array.from(next);
}

function uniqueIds(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const list = Array.from(values);
  for (let i = 0; i < list.length; i++) {
    const id = String(list[i] || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
