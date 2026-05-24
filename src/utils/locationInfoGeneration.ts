import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import { DEFAULT_GEMINI_MODEL, GeminiServiceError, generateLocationInfo } from '../services/GeminiService';
import { emitLocationInfoAIStatus } from './locationInfoAIEvents';
import {
  type LocationInfoMergeSection,
  type LocationInfoNotes,
  mergeAIResult,
  parseLocationInfoNotes,
  placeNameAndCountry,
  serializeLocationInfoNotes,
  locationInfoHasAIContent
} from './locationInfoEntry';

export async function applyLocationInfoAIResult(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  existing: LocationInfoNotes;
  apiKey: string;
  place: Place;
  section?: LocationInfoMergeSection;
}): Promise<LocationInfoNotes> {
  const { spContext, entry, existing, apiKey, place, section } = options;
  const { placeName, country } = placeNameAndCountry(place);
  const result = await generateLocationInfo(placeName, country, { apiKey });
  const merged = mergeAIResult(existing, result, section, DEFAULT_GEMINI_MODEL);
  const svc = new ItineraryService(spContext);
  await svc.update(entry.id, { notes: serializeLocationInfoNotes(merged) });
  return merged;
}

export function scheduleLocationInfoAIGeneration(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  section?: LocationInfoMergeSection;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, section, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;

  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;
  if (!section && parsed.aiGenerated) return;
  if (!section && locationInfoHasAIContent(parsed) && parsed.aiGenerated) return;

  const sectionKey = section ?? 'all';
  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: sectionKey });

  void (async () => {
    try {
      await applyLocationInfoAIResult({
        spContext,
        entry,
        existing: parsed,
        apiKey: key,
        place,
        section
      });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: sectionKey, success: true });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message =
        err instanceof GeminiServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Generation failed';
      const svc = new ItineraryService(spContext);
      try {
        await svc.update(entry.id, {
          notes: serializeLocationInfoNotes({ ...parsed, aiError: message })
        });
      } catch {
        /* ignore persist error */
      }
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: sectionKey, error: message });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    }
  })();
}
