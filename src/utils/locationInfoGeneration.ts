import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import { formatGeminiUserMessage } from '../services/geminiErrorMessage';
import { answerLocationQuestion, generateDiningSuggestions, generateLocationInfo, generateNearestPlaces } from '../services/GeminiService';
import { emitLocationInfoAIStatus } from './locationInfoAIEvents';
import { resolveLocationSearchContext } from './locationGeoContext';
import {
  type LocationInfoMergeSection,
  type LocationInfoNotes,
  type LocationInfoQaEntry,
  type NearestPlaceKind,
  mergeAIResult,
  normalizeLocationInfoNotes,
  parseLocationInfoNotes,
  placeNameAndCountry,
  serializeLocationInfoNotes,
  locationInfoIsPopulated
} from './locationInfoEntry';

async function loadLatestNotes(
  spContext: WebPartContext,
  entry: ItineraryEntry,
  fallback: LocationInfoNotes
): Promise<LocationInfoNotes> {
  const svc = new ItineraryService(spContext);
  try {
    const latest = await svc.getById(entry.id);
    return parseLocationInfoNotes(latest.notes) ?? fallback;
  } catch {
    return fallback;
  }
}

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
  const { result, model } = await generateLocationInfo(placeName, country, { apiKey });
  const merged = mergeAIResult(existing, result, section, model);
  const svc = new ItineraryService(spContext);
  await svc.update(entry.id, { notes: serializeLocationInfoNotes(merged) });
  return merged;
}

export async function applyLocationInfoQuestion(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  existing: LocationInfoNotes;
  apiKey: string;
  place: Place;
  question: string;
}): Promise<LocationInfoNotes> {
  const { spContext, entry, existing, apiKey, place, question } = options;
  const { placeName, country } = placeNameAndCountry(place);
  const contextSummary = [
    existing.overview.trim() ? `Overview: ${existing.overview.trim()}` : '',
    existing.practicalTips.trim() ? `Practical tips: ${existing.practicalTips.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n');
  const { answer, model } = await answerLocationQuestion(placeName, country, question, {
    apiKey,
    contextSummary
  });
  const qa: LocationInfoQaEntry = {
    id: `qa-${Date.now()}`,
    question: question.trim(),
    answer,
    createdAt: new Date().toISOString()
  };
  const merged: LocationInfoNotes = {
    ...existing,
    aiQaThread: [...(existing.aiQaThread ?? []), qa],
    aiModel: model,
    aiError: ''
  };
  const svc = new ItineraryService(spContext);
  await svc.update(entry.id, { notes: serializeLocationInfoNotes(merged) });
  return merged;
}

export interface ScheduleLocationInfoAIOptions {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  section?: LocationInfoMergeSection;
  /** When true, only append new AI suggestions (manual refresh on populated cards). */
  additiveOnly?: boolean;
  onComplete?: () => void;
}

export function scheduleLocationInfoAIGeneration(options: ScheduleLocationInfoAIOptions): void {
  const { spContext, entry, place, apiKey, section, additiveOnly, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;

  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;

  if (!section && !additiveOnly && locationInfoIsPopulated(parsed)) {
    return;
  }

  const sectionKey = section ?? 'all';
  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: sectionKey });

  void (async () => {
    try {
      const latest = await loadLatestNotes(spContext, entry, parsed);
      await applyLocationInfoAIResult({
        spContext,
        entry,
        existing: latest,
        apiKey: key,
        place,
        section
      });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: sectionKey, success: true });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
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

export function scheduleLocationInfoQuestion(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  question: string;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, question, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;
  const q = (question || '').trim();
  if (!q) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: 'qa' });

  void (async () => {
    try {
      const latest = await loadLatestNotes(spContext, entry, parsed);
      await applyLocationInfoQuestion({
        spContext,
        entry,
        existing: latest,
        apiKey: key,
        place,
        question: q
      });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'qa', success: true });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'qa', error: message });
      if (onComplete) onComplete();
    }
  })();
}

export function scheduleLocationInfoDining(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  replaceExisting?: boolean;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, replaceExisting, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: 'dining' });
  void (async () => {
    try {
      const latest = await loadLatestNotes(spContext, entry, parsed);
      const searchContext = await resolveLocationSearchContext(place);
      if (!searchContext) throw new Error('Could not resolve location for dining search.');
      const { items, model } = await generateDiningSuggestions({
        apiKey: key,
        searchContext
      });
      const existing = replaceExisting ? [] : (latest.diningSuggestions ?? []);
      const existingKeys = new Set(existing.map((x) => x.name.trim().toLowerCase()));
      const mergedItems = [...existing];
      for (let i = 0; i < items.length; i++) {
        const name = items[i].name.trim();
        const lk = name.toLowerCase();
        if (!name || existingKeys.has(lk)) continue;
        mergedItems.push(items[i]);
        existingKeys.add(lk);
      }
      const next = normalizeLocationInfoNotes({
        ...latest,
        diningSuggestions: replaceExisting ? items : mergedItems,
        aiModel: model,
        aiError: ''
      });
      const svc = new ItineraryService(spContext);
      await svc.update(entry.id, { notes: serializeLocationInfoNotes(next) });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'dining', success: true });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'dining', error: message });
      if (onComplete) onComplete();
    }
  })();
}

export function scheduleLocationInfoNearest(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  kind: NearestPlaceKind;
  replaceExisting?: boolean;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, kind, replaceExisting, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: kind });
  void (async () => {
    try {
      const latest = await loadLatestNotes(spContext, entry, parsed);
      const searchContext = await resolveLocationSearchContext(place);
      if (!searchContext) throw new Error('Could not resolve location for nearest search.');
      const { places, model } = await generateNearestPlaces(kind, {
        apiKey: key,
        searchContext
      });
      const nearestPlaces = { ...(latest.nearestPlaces ?? {}), [kind]: places };
      const next = normalizeLocationInfoNotes({
        ...latest,
        nearestPlaces,
        aiModel: model,
        aiError: ''
      });
      const svc = new ItineraryService(spContext);
      await svc.update(entry.id, { notes: serializeLocationInfoNotes(next) });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: kind, success: true });
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: kind, error: message });
      if (onComplete) onComplete();
    }
  })();
}
