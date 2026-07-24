import type { WebPartContext } from '@microsoft/sp-webpart-base';
import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import { DayService } from '../services/DayService';
import { ItineraryService } from '../services/ItineraryService';
import { PlaceService } from '../services/PlaceService';
import { TripService } from '../services/TripService';
import { formatGeminiUserMessage } from '../services/geminiErrorMessage';
import { answerLocationQuestion, generateDiningSuggestions, generateLocationInfo, generateNearestPlaces } from '../services/GeminiService';
import { emitLocationInfoAIStatus } from './locationInfoAIEvents';
import { resolveLocationSearchContext } from './locationGeoContext';
import { buildLocationPlaceAiContext } from './buildTripDayAiContext';
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
  locationInfoIsPopulated,
  isLocationInfoEntry
} from './locationInfoEntry';
import { buildCanonicalLocationInfoByPlaceId } from './locationInfoDayResolve';

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

async function resolveCanonicalLocationEntry(
  spContext: WebPartContext,
  entry: ItineraryEntry,
  place: Place
): Promise<ItineraryEntry> {
  const svc = new ItineraryService(spContext);
  try {
    const all = await svc.getAll(entry.tripId);
    const byPlace = buildCanonicalLocationInfoByPlaceId(all, entry.tripId);
    const canonical = byPlace.get(place.id);
    return canonical ?? entry;
  } catch {
    return entry;
  }
}

async function loadLocationQaTripContext(
  spContext: WebPartContext,
  tripId: string,
  place: Place
): Promise<string> {
  try {
    const [trip, tripDays, entries, places] = await Promise.all([
      new TripService(spContext).getById(tripId),
      new DayService(spContext).getAll(tripId),
      new ItineraryService(spContext).getAll(tripId),
      new PlaceService(spContext).getAll()
    ]);
    const placeMap = new Map(places.map((p) => [p.id, p]));
    return buildLocationPlaceAiContext({
      trip,
      tripDays,
      entries: entries.filter((e) => !isLocationInfoEntry(e)),
      place,
      placeForDay: (day) => {
        const pid = day.primaryPlaceId;
        return pid ? placeMap.get(pid) : undefined;
      }
    });
  } catch {
    return '';
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
  /** When set, nest the new Q&A under this parent answer as a reply. */
  parentQaId?: string;
}): Promise<LocationInfoNotes> {
  const { spContext, entry, existing, apiKey, place, question, parentQaId } = options;
  const { placeName, country } = placeNameAndCountry(place);
  const notesBits = [
    existing.overview.trim() ? `Overview: ${existing.overview.trim()}` : '',
    (() => {
      const sights = (existing.iconicSightsItems ?? []).map((i) => i.label).filter(Boolean);
      const food = (existing.foodDrinkItems ?? []).map((i) => i.label).filter(Boolean);
      const drink = (existing.drinkItems ?? []).map((i) => i.label).filter(Boolean);
      const souvenirs = (existing.souvenirItems ?? []).map((i) => i.label).filter(Boolean);
      const parts = [
        sights.length ? `Sights: ${sights.join('; ')}` : '',
        food.length ? `Food: ${food.join('; ')}` : '',
        drink.length ? `Drink: ${drink.join('; ')}` : '',
        souvenirs.length ? `Souvenirs: ${souvenirs.join('; ')}` : ''
      ].filter(Boolean);
      return parts.length ? `Location highlights:\n${parts.join('\n')}` : '';
    })(),
    existing.practicalTips.trim() ? `Practical tips: ${existing.practicalTips.trim()}` : '',
    (existing.savedTravelTips || []).length
      ? `Saved travel tips: ${existing.savedTravelTips!.map((t) => (typeof t === 'string' ? t : t.text)).join('; ')}`
      : '',
    (existing.userNotes || '').trim() ? `Traveller notes: ${(existing.userNotes || '').trim()}` : ''
  ].filter(Boolean);
  const itineraryContext = await loadLocationQaTripContext(spContext, entry.tripId, place);

  const parent = parentQaId
    ? (existing.aiQaThread ?? []).find((q) => q.id === parentQaId)
    : undefined;
  const threadBits: string[] = [];
  if (parent) {
    threadBits.push(`Original question: ${parent.question}`);
    threadBits.push(`Original answer: ${parent.answer}`);
    for (const r of parent.replies ?? []) {
      threadBits.push(`Earlier follow-up Q: ${r.question}`);
      threadBits.push(`Earlier follow-up A: ${r.answer}`);
    }
    threadBits.push('Answer the follow-up in the context of this thread — do not require the traveller to restate prior details.');
  }

  const contextSummary = [itineraryContext, notesBits.join('\n'), threadBits.join('\n')]
    .filter(Boolean)
    .join('\n\n');
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

  let nextThread = existing.aiQaThread ?? [];
  if (parentQaId) {
    nextThread = nextThread.map((item) =>
      item.id === parentQaId ? { ...item, replies: [...(item.replies ?? []), qa] } : item
    );
  } else {
    nextThread = [...nextThread, qa];
  }

  const merged: LocationInfoNotes = {
    ...existing,
    aiQaThread: nextThread,
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
      const targetEntry = await resolveCanonicalLocationEntry(spContext, entry, place);
      const latest = await loadLatestNotes(spContext, targetEntry, parsed);
      await applyLocationInfoAIResult({
        spContext,
        entry: targetEntry,
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
  parentQaId?: string;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, question, parentQaId, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;
  const q = (question || '').trim();
  if (!q) return;

  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section: 'qa' });

  void (async () => {
    try {
      const targetEntry = await resolveCanonicalLocationEntry(spContext, entry, place);
      if (targetEntry.id !== entry.id) {
        emitLocationInfoAIStatus({ entryId: targetEntry.id, loading: true, section: 'qa' });
      }
      const latest = await loadLatestNotes(spContext, targetEntry, parsed);
      await applyLocationInfoQuestion({
        spContext,
        entry: targetEntry,
        existing: latest,
        apiKey: key,
        place,
        question: q,
        parentQaId
      });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'qa', success: true });
      if (targetEntry.id !== entry.id) {
        emitLocationInfoAIStatus({ entryId: targetEntry.id, loading: false, section: 'qa', success: true });
      }
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section: 'qa', error: message });
      if (onComplete) onComplete();
    }
  })();
}

/** Ask AI about a saved travel tip — answer is stored on that tip's qaThread. */
export function scheduleTravelTipQuestion(options: {
  spContext: WebPartContext;
  entry: ItineraryEntry;
  place: Place;
  apiKey: string;
  tipId: string;
  question: string;
  onComplete?: () => void;
}): void {
  const { spContext, entry, place, apiKey, tipId, question, onComplete } = options;
  const key = (apiKey || '').trim();
  if (!key) return;
  const parsed = parseLocationInfoNotes(entry.notes);
  if (!parsed) return;
  const q = (question || '').trim();
  const tipKey = (tipId || '').trim();
  if (!q || !tipKey) return;

  const section = 'tip-qa' as const;
  emitLocationInfoAIStatus({ entryId: entry.id, loading: true, section, tipId: tipKey });

  void (async () => {
    try {
      const targetEntry = await resolveCanonicalLocationEntry(spContext, entry, place);
      if (targetEntry.id !== entry.id) {
        emitLocationInfoAIStatus({ entryId: targetEntry.id, loading: true, section, tipId: tipKey });
      }
      const latest = await loadLatestNotes(spContext, targetEntry, parsed);
      const tips = latest.savedTravelTips || [];
      const tip = tips.find((t) => t.id === tipKey);
      if (!tip) throw new Error('Travel tip not found.');

      const { placeName, country } = placeNameAndCountry(place);
      const contextSummary = [
        `Travel tip: ${tip.text}`,
        tip.qaThread?.length
          ? `Earlier tip Q&A:\n${tip.qaThread.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join('\n')}`
          : '',
        latest.overview.trim() ? `Place overview: ${latest.overview.trim()}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');
      const { answer, model } = await answerLocationQuestion(placeName, country, q, {
        apiKey: key,
        contextSummary
      });
      const qa: LocationInfoQaEntry = {
        id: `tip-qa-${Date.now()}`,
        question: q,
        answer,
        createdAt: new Date().toISOString()
      };
      const nextTips = tips.map((t) =>
        t.id === tipKey ? { ...t, qaThread: [...(t.qaThread ?? []), qa] } : t
      );
      const merged: LocationInfoNotes = {
        ...latest,
        savedTravelTips: nextTips,
        aiModel: model,
        aiError: ''
      };
      const svc = new ItineraryService(spContext);
      await svc.update(targetEntry.id, { notes: serializeLocationInfoNotes(normalizeLocationInfoNotes(merged)) });
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section, tipId: tipKey, success: true });
      if (targetEntry.id !== entry.id) {
        emitLocationInfoAIStatus({
          entryId: targetEntry.id,
          loading: false,
          section,
          tipId: tipKey,
          success: true
        });
      }
      if (onComplete) onComplete();
      window.dispatchEvent(new Event('trip-itinerary-updated'));
    } catch (err) {
      const message = formatGeminiUserMessage(err);
      emitLocationInfoAIStatus({ entryId: entry.id, loading: false, section, tipId: tipKey, error: message });
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
      const targetEntry = await resolveCanonicalLocationEntry(spContext, entry, place);
      const latest = await loadLatestNotes(spContext, targetEntry, parsed);
      const searchContext = await resolveLocationSearchContext(place, { forceTripPlace: true });
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
      await svc.update(targetEntry.id, { notes: serializeLocationInfoNotes(next) });
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
      const targetEntry = await resolveCanonicalLocationEntry(spContext, entry, place);
      const latest = await loadLatestNotes(spContext, targetEntry, parsed);
      const searchContext = await resolveLocationSearchContext(place, { forceTripPlace: true });
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
      await svc.update(targetEntry.id, { notes: serializeLocationInfoNotes(next) });
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
