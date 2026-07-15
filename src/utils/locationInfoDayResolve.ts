import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { compareTripDaysChronological } from './tripDateRangeSync';
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
 * One canonical Location info card per placeId for the trip.
 * Notes are the union of all duplicate cards (Q&A, saved places, etc.) so the UI
 * never drops data that still lives on a non-keeper duplicate before sync deletes it.
 */
export function buildCanonicalLocationInfoByPlaceId(
  entries: ItineraryEntry[],
  tripId: string
): Map<string, ItineraryEntry> {
  const cards = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);
  const groups = new Map<string, ItineraryEntry[]>();
  for (const card of cards) {
    const pid = locationInfoPlaceId(card);
    if (!pid) continue;
    const list = groups.get(pid) ?? [];
    list.push(card);
    groups.set(pid, list);
  }

  const byPlace = new Map<string, ItineraryEntry>();
  groups.forEach((group, pid) => {
    let keeper = group[0];
    for (let i = 1; i < group.length; i++) {
      keeper = preferCanonical(keeper, group[i]);
    }
    let mergedNotes = parseLocationInfoNotes(keeper.notes);
    if (!mergedNotes) {
      byPlace.set(pid, keeper);
      return;
    }
    for (let i = 0; i < group.length; i++) {
      if (group[i].id === keeper.id) continue;
      const other = parseLocationInfoNotes(group[i].notes);
      if (!other) continue;
      mergedNotes = mergeLocationInfoNotes(mergedNotes, other);
    }
    byPlace.set(pid, {
      ...keeper,
      notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(mergedNotes))
    });
  });
  return byPlace;
}

/** Location info cards to show as chips on a day — always the canonical card per place. */
export function locationInfoEntriesForDay(
  day: TripDay,
  entries: ItineraryEntry[],
  tripId: string
): ItineraryEntry[] {
  const placeIds = collectPlaceIdsForDay(day);
  if (!placeIds.length) return [];
  const byPlace = buildCanonicalLocationInfoByPlaceId(entries, tripId);
  const result: ItineraryEntry[] = [];
  for (let i = 0; i < placeIds.length; i++) {
    const card = byPlace.get(placeIds[i]);
    if (card) result.push(card);
  }
  return result;
}

export function firstDayIdForPlace(tripDays: TripDay[], tripId: string, placeId: string): string | undefined {
  const sorted = tripDays.filter((d) => d.tripId === tripId).sort(compareTripDaysChronological);
  return sorted.find((d) => collectPlaceIdsForDay(d).indexOf(placeId) >= 0)?.id;
}
