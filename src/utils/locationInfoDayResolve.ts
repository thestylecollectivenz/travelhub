import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { compareTripDaysChronological } from './tripDateRangeSync';
import {
  isLocationInfoEntry,
  locationInfoIsPopulated,
  locationInfoPlaceId,
  parseLocationInfoNotes
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
  return locationInfoIsPopulated(data) ? 1 : 0;
}

/** One canonical Location info card per placeId for the trip. */
export function buildCanonicalLocationInfoByPlaceId(
  entries: ItineraryEntry[],
  tripId: string
): Map<string, ItineraryEntry> {
  const cards = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);
  const byPlace = new Map<string, ItineraryEntry>();
  for (const card of cards) {
    const pid = locationInfoPlaceId(card);
    if (!pid) continue;
    const existing = byPlace.get(pid);
    if (!existing) {
      byPlace.set(pid, card);
      continue;
    }
    const existingScore = cardPopulatedScore(existing);
    const cardScore = cardPopulatedScore(card);
    if (cardScore > existingScore) {
      byPlace.set(pid, card);
    } else if (cardScore === existingScore && (card.sortOrder ?? 0) < (existing.sortOrder ?? 0)) {
      byPlace.set(pid, card);
    }
  }
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
