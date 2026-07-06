import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import { ItineraryService } from '../services/ItineraryService';
import { formatGeminiUserMessage } from '../services/geminiErrorMessage';
import { answerLocationQuestion, generateDiningSuggestions, generateLocationInfo, generateNearestPlaces } from '../services/GeminiService';
import { emitLocationInfoAIStatus } from './locationInfoAIEvents';
import { resolveGeoCoords } from './locationGeoContext';
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
      await applyLocationInfoQuestion({
        spContext,
        entry,
        existing: parsed,
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
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: 'dining' });
  void (async () => {
    try {
      const coords = await resolveGeoCoords(place);
      const { placeName, country } = placeNameAndCountry(place);
      const { items, model } = await generateDiningSuggestions(placeName, country, {
        apiKey: key,
        coords: coords ? { lat: coords.latitude, lon: coords.longitude } : undefined
      });
      const existing = parsed.diningSuggestions ?? [];
      const existingKeys = new Set(existing.map((x) => x.label.trim().toLowerCase()));
      const mergedItems = [...existing];
      for (let i = 0; i < items.length; i++) {
        const label = items[i].label.trim();
        const lk = label.toLowerCase();
        if (!label || existingKeys.has(lk)) continue;
        mergedItems.push({
          id: `dining-${Date.now()}-${i}`,
          label,
          done: false,
          source: 'ai'
        });
        existingKeys.add(lk);
      }
      const next = normalizeLocationInfoNotes({
        ...parsed,
        diningSuggestions: mergedItems,
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
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, kind, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: kind });
  void (async () => {
    try {
      const coords = await resolveGeoCoords(place);
      const { placeName, country } = placeNameAndCountry(place);
      const { places, model } = await generateNearestPlaces(placeName, country, kind, {
        apiKey: key,
        coords: coords ? { lat: coords.latitude, lon: coords.longitude } : undefined
      });
      const nearestPlaces = { ...(parsed.nearestPlaces ?? {}), [kind]: places };
      const next = normalizeLocationInfoNotes({
        ...parsed,
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
