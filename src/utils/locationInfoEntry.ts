import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { placeDisplayLabel, placeNameFromTitle } from './placeDisplayLabel';
import type { Place } from '../models/Place';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

export const LOCATION_INFO_CATEGORY = 'Location info';

export type LocationInfoCheckItem = {
  id: string;
  label: string;
  done: boolean;
  /** User-added or user-edited items are never changed by AI merge. */
  source?: 'ai' | 'user';
};

export type LocationInfoQaEntry = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

export type LocationInfoNotes = {
  placeId: string;
  overview: string;
  iconicSights: string;
  foodDrink: string;
  practicalTips: string;
  iconicSightsItems?: LocationInfoCheckItem[];
  foodDrinkItems?: LocationInfoCheckItem[];
  drinkItems?: LocationInfoCheckItem[];
  souvenirItems?: LocationInfoCheckItem[];
  aiSightsPlaceholder?: string;
  aiFoodPlaceholder?: string;
  aiGenerated?: boolean;
  aiGeneratedAt?: string;
  aiModel?: string;
  aiError?: string;
  /** Labels the user removed — AI must not re-add them. */
  suppressedHighlightKeys?: string[];
  userEditedOverview?: boolean;
  userEditedPracticalTips?: boolean;
  aiQaThread?: LocationInfoQaEntry[];
};

export type LocationInfoAIResult = {
  overview: string;
  practicalTips: string;
  sights: Array<{ label: string; done: boolean }>;
  food: Array<{ label: string; done: boolean }>;
  drink: Array<{ label: string; done: boolean }>;
  souvenirs: Array<{ label: string; done: boolean }>;
};

export type LocationInfoMergeSection = 'sights' | 'food' | 'drink' | 'souvenirs';

function labelKey(label: string): string {
  return (label || '').trim().toLowerCase();
}

function suppressedKeySet(data: LocationInfoNotes): Set<string> {
  const keys = data.suppressedHighlightKeys ?? [];
  const set = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    set.add(keys[i]);
  }
  return set;
}

/** Additive merge: keep every existing row; only append new AI labels; never change done on existing rows. */
function aiRowsToCheckItems(
  rows: Array<{ label: string; done: boolean }>,
  existing: LocationInfoCheckItem[],
  suppressed: Set<string>
): LocationInfoCheckItem[] {
  const merged: LocationInfoCheckItem[] = [];
  for (let i = 0; i < existing.length; i++) {
    merged.push({ ...existing[i] });
  }

  const existingKeys = new Set<string>();
  for (let i = 0; i < existing.length; i++) {
    existingKeys.add(labelKey(existing[i].label));
  }

  let addIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    const label = rows[i].label.trim();
    if (!label) continue;
    const key = labelKey(label);
    if (suppressed.has(key) || existingKeys.has(key)) continue;
    merged.push({
      id: `item-ai-${Date.now()}-${addIndex}`,
      label,
      done: false,
      source: 'ai'
    });
    existingKeys.add(key);
    addIndex++;
  }

  return merged;
}

function mergeOneSection(
  existing: LocationInfoNotes,
  result: LocationInfoAIResult,
  section: LocationInfoMergeSection
): LocationInfoNotes {
  const suppressed = suppressedKeySet(existing);
  if (section === 'sights') {
    const iconicSightsItems = aiRowsToCheckItems(result.sights, getIconicSightsItems(existing), suppressed);
    return { ...existing, iconicSightsItems, iconicSights: checkItemsToText(iconicSightsItems) };
  }
  if (section === 'food') {
    const foodDrinkItems = aiRowsToCheckItems(result.food, getFoodDrinkItems(existing), suppressed);
    return { ...existing, foodDrinkItems, foodDrink: checkItemsToText(foodDrinkItems) };
  }
  if (section === 'drink') {
    const drinkItems = aiRowsToCheckItems(result.drink, existing.drinkItems ?? [], suppressed);
    return { ...existing, drinkItems };
  }
  const souvenirItems = aiRowsToCheckItems(result.souvenirs, existing.souvenirItems ?? [], suppressed);
  return { ...existing, souvenirItems };
}

/**
 * Merge AI output into notes.
 * Never overwrites user-edited overview/practical tips, existing highlight rows, or checked state.
 */
export function mergeAIResult(
  existing: LocationInfoNotes,
  result: LocationInfoAIResult,
  section?: LocationInfoMergeSection,
  model = 'gemini-3.1-flash-lite'
): LocationInfoNotes {
  const base = normalizeLocationInfoNotes(existing);
  let next: LocationInfoNotes = { ...base };

  if (!section || section === 'sights') {
    next = mergeOneSection(next, result, 'sights');
  }
  if (!section || section === 'food') {
    next = mergeOneSection(next, result, 'food');
  }
  if (!section || section === 'drink') {
    next = mergeOneSection(next, result, 'drink');
  }
  if (!section || section === 'souvenirs') {
    next = mergeOneSection(next, result, 'souvenirs');
  }

  if (!section) {
    if (!next.userEditedOverview && !(next.overview || '').trim()) {
      next.overview = result.overview.trim();
    }
    if (!next.userEditedPracticalTips && !(next.practicalTips || '').trim()) {
      next.practicalTips = result.practicalTips.trim();
    }
  }

  next.aiGenerated = true;
  next.aiGeneratedAt = new Date().toISOString();
  next.aiModel = model;
  next.aiError = '';

  return normalizeLocationInfoNotes(next);
}

/** True when the card already has content worth preserving (skip auto-run on trip open). */
export function locationInfoIsPopulated(data: LocationInfoNotes): boolean {
  if ((data.overview || '').trim()) return true;
  if ((data.practicalTips || '').trim()) return true;
  if (getIconicSightsItems(data).length) return true;
  if (getFoodDrinkItems(data).length) return true;
  if ((data.drinkItems ?? []).length) return true;
  if ((data.souvenirItems ?? []).length) return true;
  if ((data.aiQaThread ?? []).length) return true;
  return false;
}

/** @deprecated Use locationInfoIsPopulated — kept for existing imports. */
export function locationInfoHasAIContent(data: LocationInfoNotes): boolean {
  return locationInfoIsPopulated(data);
}

export function recordSuppressedHighlightLabels(
  previous: LocationInfoNotes,
  previousRows: LocationHighlightRow[],
  nextRows: LocationHighlightRow[]
): string[] {
  const nextKeys = new Set<string>();
  for (let i = 0; i < nextRows.length; i++) {
    nextKeys.add(labelKey(nextRows[i].label));
  }
  const suppressed = [...(previous.suppressedHighlightKeys ?? [])];
  const suppressedSet = new Set(suppressed);
  for (let i = 0; i < previousRows.length; i++) {
    const row = previousRows[i];
    const key = labelKey(row.label);
    if (!nextKeys.has(key) && !suppressedSet.has(key)) {
      suppressed.push(key);
      suppressedSet.add(key);
    }
  }
  return suppressed;
}

export function markHighlightRowsUserEdited(rows: LocationHighlightRow[]): LocationHighlightRow[] {
  return rows.map((row) => ({ ...row, source: 'user' as const }));
}

export function placeNameAndCountry(place: Pick<Place, 'title' | 'country'>): { placeName: string; country: string } {
  const label = placeDisplayLabel(place);
  const comma = label.indexOf(',');
  if (comma >= 0) {
    return {
      placeName: label.slice(0, comma).trim(),
      country: label.slice(comma + 1).trim()
    };
  }
  return {
    placeName: placeNameFromTitle(place.title) || label,
    country: (place.country || '').trim()
  };
}

export function linesToCheckItems(text: string, kind?: LocationHighlightKind): LocationInfoCheckItem[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: LocationInfoCheckItem[] = [];
  const prefix = kind ? `${kind}-` : '';
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].replace(/^[-*•]\s*/, '').trim();
    if (!label) continue;
    items.push({
      id: `${prefix}item-${i}-${label.slice(0, 12).replace(/\W/g, '')}`,
      label,
      done: false,
      source: 'user'
    });
  }
  return items;
}

export function checkItemsToText(items: LocationInfoCheckItem[] | undefined): string {
  return (items ?? []).map((x) => x.label).filter(Boolean).join('\n');
}

export function getIconicSightsItems(data: LocationInfoNotes): LocationInfoCheckItem[] {
  if (data.iconicSightsItems !== undefined) return data.iconicSightsItems;
  return linesToCheckItems(data.iconicSights, 'sight');
}

export function getFoodDrinkItems(data: LocationInfoNotes): LocationInfoCheckItem[] {
  if (data.foodDrinkItems !== undefined) return data.foodDrinkItems;
  return linesToCheckItems(data.foodDrink, 'food');
}

export type LocationHighlightKind = 'sight' | 'food' | 'drink' | 'souvenir';

export type LocationHighlightRow = LocationInfoCheckItem & { kind: LocationHighlightKind };

export function locationHighlightRows(data: LocationInfoNotes): LocationHighlightRow[] {
  const rows: LocationHighlightRow[] = [];
  getIconicSightsItems(data).forEach((item) => rows.push({ ...item, kind: 'sight' }));
  getFoodDrinkItems(data).forEach((item) => rows.push({ ...item, kind: 'food' }));
  (data.drinkItems ?? []).forEach((item) => rows.push({ ...item, kind: 'drink' }));
  (data.souvenirItems ?? []).forEach((item) => rows.push({ ...item, kind: 'souvenir' }));
  return rows;
}

export function splitHighlightRows(rows: LocationHighlightRow[]): Pick<LocationInfoNotes, 'iconicSightsItems' | 'foodDrinkItems' | 'drinkItems' | 'souvenirItems'> {
  return {
    iconicSightsItems: rows.filter((r) => r.kind === 'sight').map(({ kind, ...item }) => item),
    foodDrinkItems: rows.filter((r) => r.kind === 'food').map(({ kind, ...item }) => item),
    drinkItems: rows.filter((r) => r.kind === 'drink').map(({ kind, ...item }) => item),
    souvenirItems: rows.filter((r) => r.kind === 'souvenir').map(({ kind, ...item }) => item)
  };
}

/** Ensure highlight IDs are unique per category (fixes legacy cross-category collisions). */
export function ensureUniqueHighlightIds(data: LocationInfoNotes): LocationInfoNotes {
  const fix = (items: LocationInfoCheckItem[], kind: LocationHighlightKind): LocationInfoCheckItem[] => {
    const seen = new Set<string>();
    return items.map((item, index) => {
      const prefix = `${kind}-`;
      let id = item.id?.trim() || `${prefix}item-${index}`;
      if (!id.startsWith(prefix)) {
        id = `${prefix}${id}`;
      }
      while (seen.has(id)) {
        id = `${prefix}item-${index}-${seen.size}`;
      }
      seen.add(id);
      return id === item.id ? item : { ...item, id };
    });
  };

  const iconicSightsItems = fix(getIconicSightsItems(data), 'sight');
  const foodDrinkItems = fix(getFoodDrinkItems(data), 'food');
  const drinkItems = fix(data.drinkItems ?? [], 'drink');
  const souvenirItems = fix(data.souvenirItems ?? [], 'souvenir');

  return {
    ...data,
    iconicSightsItems,
    foodDrinkItems,
    drinkItems,
    souvenirItems
  };
}

export function normalizeLocationInfoNotes(data: LocationInfoNotes): LocationInfoNotes {
  const withIds = ensureUniqueHighlightIds(data);
  const iconicSightsItems = getIconicSightsItems(withIds);
  const foodDrinkItems = getFoodDrinkItems(withIds);
  const drinkItems = withIds.drinkItems ?? [];
  const souvenirItems = withIds.souvenirItems ?? [];
  return {
    ...withIds,
    iconicSightsItems,
    foodDrinkItems,
    drinkItems,
    souvenirItems,
    iconicSights: checkItemsToText(iconicSightsItems),
    foodDrink: checkItemsToText(foodDrinkItems),
    aiQaThread: data.aiQaThread ?? []
  };
}

export function isLocationInfoEntry(entry: Pick<ItineraryEntry, 'category'>): boolean {
  return (entry.category || '').trim() === LOCATION_INFO_CATEGORY;
}

export function parseLocationInfoNotes(notes: string | undefined): LocationInfoNotes | null {
  const raw = (notes || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LocationInfoNotes;
    if (parsed && typeof parsed.placeId === 'string') return parsed;
  } catch {
    /* legacy plain text */
  }
  return null;
}

export function serializeLocationInfoNotes(data: LocationInfoNotes): string {
  return JSON.stringify(data);
}

export function defaultLocationInfoNotes(placeId: string): LocationInfoNotes {
  return {
    placeId,
    overview: '',
    iconicSights: '',
    foodDrink: '',
    practicalTips: '',
    aiSightsPlaceholder: 'Highlights generate in the background when you open a trip (Gemini key required), or use the button below.',
    aiQaThread: []
  };
}

export function locationInfoPlaceId(entry: ItineraryEntry): string {
  return parseLocationInfoNotes(entry.notes)?.placeId?.trim() || '';
}

export function dayHasPlaceId(day: TripDay, placeId: string, placeById: (id: string) => Place | undefined): boolean {
  if (!placeId) return false;
  if (day.primaryPlaceId === placeId) return true;
  for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
    if (ref.placeId === placeId) return true;
  }
  return false;
}

export function buildLocationInfoEntryDraft(options: {
  tripId: string;
  dayId: string;
  place: Place;
  sortOrder: number;
}): Omit<ItineraryEntry, 'id'> {
  const label = placeDisplayLabel(options.place);
  const notes = serializeLocationInfoNotes(defaultLocationInfoNotes(options.place.id));
  return {
    tripId: options.tripId,
    dayId: options.dayId,
    title: label,
    category: LOCATION_INFO_CATEGORY,
    location: label,
    timeStart: '',
    duration: '',
    supplier: '',
    notes,
    decisionStatus: 'Idea',
    bookingRequired: false,
    bookingStatus: 'Not booked',
    paymentStatus: 'Free',
    amount: 0,
    currency: 'NZD',
    sortOrder: options.sortOrder
  };
}
