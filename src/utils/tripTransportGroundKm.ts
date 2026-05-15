import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import type { TripDay } from '../models/TripDay';
import { haversineKm } from './distanceUtils';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

function normalizeLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',');
}

/** Best-effort match of free-text (transport From/To) to a saved Place title. */
export function resolvePlaceLabel(label: string, candidates: Place[]): Place | undefined {
  const n = normalizeLabel(label);
  if (!n) return undefined;
  let best: Place | undefined;
  let rank = 0;
  for (const p of candidates) {
    const t = normalizeLabel(p.title || '');
    if (!t) continue;
    let r = 0;
    if (t === n) r = 100 + t.length;
    else if (t.startsWith(n) || n.startsWith(t)) r = 60 + Math.min(t.length, n.length);
    else if (t.includes(n)) r = 40 + n.length;
    else if (n.includes(t) && t.length >= 4) r = 30 + t.length;
    if (r > rank) {
      rank = r;
      best = p;
    }
  }
  return best;
}

export function tripPlacePool(tripId: string, tripDays: TripDay[], placeById: (id?: string) => Place | undefined): Place[] {
  const ids = new Set<string>();
  for (const d of tripDays) {
    if (d.tripId !== tripId) continue;
    if (d.primaryPlaceId) ids.add(d.primaryPlaceId);
    for (const ref of parseAdditionalPlaceRefs(d.additionalPlaceIds)) {
      ids.add(ref.placeId);
    }
  }
  const out: Place[] = [];
  for (const id of Array.from(ids)) {
    const p = placeById(id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * Sum great-circle km for Transport entries that have both From and To resolvable to Places.
 * Return journeys double the one-way distance. Unresolved labels contribute 0 for that row.
 */
export function sumTransportGroundKm(
  entries: ItineraryEntry[],
  tripId: string,
  tripDays: TripDay[],
  placeById: (id?: string) => Place | undefined,
  allPlaces: Place[]
): number {
  const tripPool = tripPlacePool(tripId, tripDays, placeById);
  let km = 0;

  for (const e of entries) {
    if (e.tripId !== tripId || e.parentEntryId) continue;
    if ((e.category || '').trim().toLowerCase() !== 'transport') continue;

    const fromLabel = (e.transportFrom || '').trim();
    const toLabel = (e.transportTo || '').trim();
    if (!fromLabel || !toLabel) continue;

    let fromP = resolvePlaceLabel(fromLabel, tripPool);
    let toP = resolvePlaceLabel(toLabel, tripPool);
    if (!fromP) fromP = resolvePlaceLabel(fromLabel, allPlaces);
    if (!toP) toP = resolvePlaceLabel(toLabel, allPlaces);
    if (!fromP || !toP) continue;
    if (!Number.isFinite(fromP.latitude) || !Number.isFinite(fromP.longitude)) continue;
    if (!Number.isFinite(toP.latitude) || !Number.isFinite(toP.longitude)) continue;

    const leg = haversineKm(fromP.latitude, fromP.longitude, toP.latitude, toP.longitude);
    if (!Number.isFinite(leg) || leg <= 0) continue;

    const mult = e.journeyType === 'return' ? 2 : 1;
    km += leg * mult;
  }

  return km;
}
