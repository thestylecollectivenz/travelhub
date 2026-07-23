import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { compareTripDaysChronological } from './tripDateRangeSync';
import { placeNameFromTitle } from './placeDisplayLabel';
import {
  isLocationInfoEntry,
  locationInfoContentScore,
  locationInfoPlaceId,
  mergeLocationInfoNotes,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes
} from './locationInfoEntry';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

/** Place ids visited on a day (primary + additional), in order. */
export function collectPlaceIdsForDay(day: TripDay): string[] {
  const ids: string[] = [];
  if (day.primaryPlaceId) ids.push(day.primaryPlaceId);
  for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
    ids.push(ref.placeId);
  }
  const unique: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (unique.indexOf(ids[i]) < 0) unique.push(ids[i]);
  }
  return unique;
}

/**
 * Merge key so "Singapore" and "Singapore, Singapore" (different Place rows)
 * still share one destination guide across days.
 * Within a trip, city name is enough — country mismatches (empty vs filled) must not split guides.
 */
export function placeGuideIdentityKey(
  placeId: string,
  placeById?: (id: string) => Place | undefined
): string {
  const place = placeById?.(placeId);
  if (!place) return `pid:${placeId}`;
  const name = placeNameFromTitle(place.title).toLowerCase().replace(/\s+/g, ' ').trim();
  if (name) return `name:${name}`;
  return `pid:${placeId}`;
}

function cardPopulatedScore(entry: ItineraryEntry): number {
  const data = parseLocationInfoNotes(entry.notes);
  if (!data) return 0;
  return locationInfoContentScore(data);
}

function preferCanonical(a: ItineraryEntry, b: ItineraryEntry): ItineraryEntry {
  const aScore = cardPopulatedScore(a);
  const bScore = cardPopulatedScore(b);
  if (bScore > aScore) return b;
  if (bScore < aScore) return a;
  if ((b.sortOrder ?? 0) < (a.sortOrder ?? 0)) return b;
  return a;
}

/**
 * One canonical Location info card per place for the trip.
 * Groups by city/country identity (when placeById is provided) so multi-day stays
 * with duplicate Place rows still show one merged guide on every day.
 */
export function buildCanonicalLocationInfoByPlaceId(
  entries: ItineraryEntry[],
  tripId: string,
  placeById?: (id: string) => Place | undefined
): Map<string, ItineraryEntry> {
  const cards = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);
  const groups = new Map<string, ItineraryEntry[]>();
  for (const card of cards) {
    const pid = locationInfoPlaceId(card);
    if (!pid) continue;
    const key = placeGuideIdentityKey(pid, placeById);
    const list = groups.get(key) ?? [];
    list.push(card);
    groups.set(key, list);
  }

  const byPlace = new Map<string, ItineraryEntry>();
  groups.forEach((group) => {
    let keeper = group[0];
    for (let i = 1; i < group.length; i++) {
      keeper = preferCanonical(keeper, group[i]);
    }
    let mergedNotes = parseLocationInfoNotes(keeper.notes);
    if (!mergedNotes) {
      for (const card of group) {
        const pid = locationInfoPlaceId(card);
        if (pid) byPlace.set(pid, keeper);
      }
      return;
    }
    for (let i = 0; i < group.length; i++) {
      if (group[i].id === keeper.id) continue;
      const other = parseLocationInfoNotes(group[i].notes);
      if (!other) continue;
      mergedNotes = mergeLocationInfoNotes(mergedNotes, other);
    }
    const canonical: ItineraryEntry = {
      ...keeper,
      notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(mergedNotes))
    };
    for (const card of group) {
      const pid = locationInfoPlaceId(card);
      if (pid) byPlace.set(pid, canonical);
    }
  });
  return byPlace;
}

/** Location info cards to show as chips on a day — always the canonical card per place. */
export function locationInfoEntriesForDay(
  day: TripDay,
  entries: ItineraryEntry[],
  tripId: string,
  placeById?: (id: string) => Place | undefined
): ItineraryEntry[] {
  const placeIds = collectPlaceIdsForDay(day);
  if (!placeIds.length) return [];
  const byPlace = buildCanonicalLocationInfoByPlaceId(entries, tripId, placeById);
  const result: ItineraryEntry[] = [];
  const seenCardIds = new Set<string>();
  for (let i = 0; i < placeIds.length; i++) {
    const card = byPlace.get(placeIds[i]);
    if (!card || seenCardIds.has(card.id)) continue;
    seenCardIds.add(card.id);
    result.push(card);
  }
  return result;
}

export function firstDayIdForPlace(tripDays: TripDay[], tripId: string, placeId: string): string | undefined {
  const sorted = tripDays.filter((d) => d.tripId === tripId).sort(compareTripDaysChronological);
  return sorted.find((d) => collectPlaceIdsForDay(d).indexOf(placeId) >= 0)?.id;
}
