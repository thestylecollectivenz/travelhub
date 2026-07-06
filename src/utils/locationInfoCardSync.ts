import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import type { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  buildLocationInfoEntryDraft,
  isLocationInfoEntry,
  locationInfoIsPopulated,
  locationInfoPlaceId,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  serializeLocationInfoNotes
} from './locationInfoEntry';
import {
  buildCanonicalLocationInfoByPlaceId,
  collectPlaceIdsForDay,
  firstDayIdForPlace
} from './locationInfoDayResolve';
import { scheduleLocationInfoAIGeneration } from './locationInfoGeneration';

/** Ensure one Location info card per place on the trip; remove orphans and duplicate place cards. */
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

  let locCards = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);

  for (const card of locCards) {
    const pid = locationInfoPlaceId(card);
    if (!pid || !placeIdsInUse.has(pid)) {
      await svc.delete(card.id);
    }
  }

  const refreshed = entries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);
  const canonicalByPlace = buildCanonicalLocationInfoByPlaceId(refreshed, tripId);

  for (const card of refreshed) {
    const pid = locationInfoPlaceId(card);
    if (!pid) continue;
    const canonical = canonicalByPlace.get(pid);
    if (!canonical || canonical.id === card.id) continue;

    const dupNotes = parseLocationInfoNotes(card.notes);
    const canNotes = parseLocationInfoNotes(canonical.notes);
    if (dupNotes && canNotes && locationInfoIsPopulated(dupNotes) && !locationInfoIsPopulated(canNotes)) {
      await svc.update(canonical.id, { notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(dupNotes)) });
    }
    await svc.delete(card.id);
  }

  locCards = entries.filter(
    (e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId && placeIdsInUse.has(locationInfoPlaceId(e) || '')
  );
  const byPlace = buildCanonicalLocationInfoByPlaceId(locCards, tripId);

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
    const created = await svc.create(
      buildLocationInfoEntryDraft({ tripId, dayId: homeDayId, place, sortOrder: maxSort + 1 })
    );
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
