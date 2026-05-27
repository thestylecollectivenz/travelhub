import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import { formatGeminiUserMessage } from '../services/geminiErrorMessage';
import { syncLocationInfoCards } from './locationInfoCardSync';
import {
  isLocationInfoEntry,
  locationInfoIsPopulated,
  locationInfoPlaceId,
  parseLocationInfoNotes,
  serializeLocationInfoNotes
} from './locationInfoEntry';
import { applyLocationInfoAIResult } from './locationInfoGeneration';

const BACKFILL_DELAY_MS = 400;
const BETWEEN_CARDS_MS = 350;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * After trip open: ensure location cards exist, then background-fill empty ones only.
 * Does not block trip load — call via setTimeout from the workspace shell.
 */
export async function runLocationInfoTripOpenBackfill(options: {
  spContext: WebPartContext;
  tripId: string;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  placeById: (id: string) => Place | undefined;
  geminiApiKey: string;
}): Promise<void> {
  const { spContext, tripId, tripDays, entries, placeById, geminiApiKey } = options;
  const apiKey = (geminiApiKey || '').trim();
  if (!apiKey) return;

  await syncLocationInfoCards({
    spContext,
    tripId,
    tripDays,
    entries,
    placeById,
    geminiApiKey: apiKey
  });

  const entrySvc = new ItineraryService(spContext);
  const freshEntries = await entrySvc.getAll(tripId);
  const cards = freshEntries.filter((e) => e.tripId === tripId && isLocationInfoEntry(e) && !e.parentEntryId);

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const parsed = parseLocationInfoNotes(card.notes);
    if (!parsed || locationInfoIsPopulated(parsed)) continue;

    const placeId = locationInfoPlaceId(card);
    const place = placeId ? placeById(placeId) : undefined;
    if (!place) continue;

    try {
      await applyLocationInfoAIResult({
        spContext,
        entry: card,
        existing: parsed,
        apiKey,
        place
      });
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      try {
        await entrySvc.update(card.id, {
          notes: serializeLocationInfoNotes({ ...parsed, aiError: message })
        });
      } catch {
        /* ignore */
      }
    }

    if (i < cards.length - 1) {
      await delay(BETWEEN_CARDS_MS);
    }
  }
}

export const LOCATION_INFO_TRIP_OPEN_BACKFILL_DELAY_MS = BACKFILL_DELAY_MS;
