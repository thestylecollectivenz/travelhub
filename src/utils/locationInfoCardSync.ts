import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import type { WebPartContext } from '@microsoft/sp-webpart-base';
import { compareTripDaysChronological } from './tripDateRangeSync';
import { buildLocationInfoEntryDraft, isLocationInfoEntry, locationInfoPlaceId } from './locationInfoEntry';
import { scheduleLocationInfoAIGeneration } from './locationInfoGeneration';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

function collectPlaceIdsForDay(day: TripDay): string[] {
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

function firstDayIdForPlace(tripDays: TripDay[], tripId: string, placeId: string): string | undefined {
  const sorted = tripDays.filter((d) => d.tripId === tripId).sort(compareTripDaysChronological);
  return sorted.find((d) => collectPlaceIdsForDay(d).indexOf(placeId) >= 0)?.id;
}

/** Ensure one Location info card per place on the trip; remove orphans when place unused. */
export async function syncLocationInfoCards(options: {
  spContext: WebPartContext;
  tripId: string;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  placeById: (id: string) => Place | undefined;
  geminiApiKey?: string;
  onCardsCreated?: () => void;
}): Promise<void> {
  const { spContext, tripId, tripDays, entries, placeById, geminiApiKey, onCardsCreated } = options;
  const svc = new ItineraryService(spContext);

  const placeIdsInUse = new Set<string>();
  for (const day of tripDays.filter((d) => d.tripId === tripId)) {
    for (const pid of collectPlaceIdsForDay(day)) {
      placeIdsInUse.add(pid);
    }
  }

  const locCards = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);

  for (const card of locCards) {
    const pid = locationInfoPlaceId(card);
    if (!pid || !placeIdsInUse.has(pid)) {
      await svc.delete(card.id);
    }
  }

  const refreshed = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);
  const byPlace = new Map<string, ItineraryEntry>();
  for (const c of refreshed) {
    const pid = locationInfoPlaceId(c);
    if (pid) byPlace.set(pid, c);
  }

  const placeIdsList: string[] = [];
  placeIdsInUse.forEach((id) => placeIdsList.push(id));
  for (let pi = 0; pi < placeIdsList.length; pi++) {
    const placeId = placeIdsList[pi];
    if (byPlace.has(placeId)) continue;
    const place = placeById(placeId);
    if (!place) continue;
    const homeDayId = firstDayIdForPlace(tripDays, tripId, placeId);
    if (!homeDayId) continue;
    const maxSort = entries
      .filter((e) => e.dayId === homeDayId && !e.parentEntryId)
      .reduce((m, e) => Math.max(m, e.sortOrder ?? 0), -1);
    const created = await svc.create(buildLocationInfoEntryDraft({ tripId, dayId: homeDayId, place, sortOrder: maxSort + 1 }));
    if ((geminiApiKey || '').trim()) {
      scheduleLocationInfoAIGeneration({
        spContext,
        entry: created,
        place,
        apiKey: geminiApiKey || '',
        onComplete: onCardsCreated
      });
    }
  }
}
