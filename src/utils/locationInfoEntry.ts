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
};

export type LocationInfoAIResult = {
  overview: string;
  sights: Array<{ label: string; done: boolean }>;
  food: Array<{ label: string; done: boolean }>;
  drink: Array<{ label: string; done: boolean }>;
  souvenirs: Array<{ label: string; done: boolean }>;
};

export type LocationInfoMergeSection = 'sights' | 'food' | 'drink' | 'souvenirs';

function labelKey(label: string): string {
  return (label || '').trim().toLowerCase();
}

function aiRowsToCheckItems(
  rows: Array<{ label: string; done: boolean }>,
  existing: LocationInfoCheckItem[]
): LocationInfoCheckItem[] {
  const existingByKey = new Map<string, LocationInfoCheckItem>();
  for (let i = 0; i < existing.length; i++) {
    existingByKey.set(labelKey(existing[i].label), existing[i]);
  }

  const incomingKeys: string[] = [];
  const merged: LocationInfoCheckItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const label = rows[i].label.trim();
    if (!label) continue;
    const key = labelKey(label);
    incomingKeys.push(key);
    const prev = existingByKey.get(key);
    merged.push({
      id: prev?.id ?? `item-${Date.now()}-${i}`,
      label,
      done: prev ? prev.done : false
    });
  }

  for (let i = 0; i < existing.length; i++) {
    const item = existing[i];
    if (incomingKeys.indexOf(labelKey(item.label)) < 0) {
      merged.push(item);
    }
  }

  return merged;
}

function mergeOneSection(
  existing: LocationInfoNotes,
  result: LocationInfoAIResult,
  section: LocationInfoMergeSection
): LocationInfoNotes {
  if (section === 'sights') {
    const iconicSightsItems = aiRowsToCheckItems(result.sights, getIconicSightsItems(existing));
    return { ...existing, iconicSightsItems, iconicSights: checkItemsToText(iconicSightsItems) };
  }
  if (section === 'food') {
    const foodDrinkItems = aiRowsToCheckItems(result.food, getFoodDrinkItems(existing));
    return { ...existing, foodDrinkItems, foodDrink: checkItemsToText(foodDrinkItems) };
  }
  if (section === 'drink') {
    const drinkItems = aiRowsToCheckItems(result.drink, existing.drinkItems ?? []);
    return { ...existing, drinkItems };
  }
  const souvenirItems = aiRowsToCheckItems(result.souvenirs, existing.souvenirItems ?? []);
  return { ...existing, souvenirItems };
}

/** Merge AI output into notes; never overwrites done:true on matching labels; keeps manual extras. */
export function mergeAIResult(
  existing: LocationInfoNotes,
  result: LocationInfoAIResult,
  section?: LocationInfoMergeSection,
  model = 'gemini-2.0-flash'
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
    next.overview = result.overview.trim();
  }

  next.aiGenerated = true;
  next.aiGeneratedAt = new Date().toISOString();
  next.aiModel = model;
  next.aiError = '';

  return normalizeLocationInfoNotes(next);
}

export function locationInfoHasAIContent(data: LocationInfoNotes): boolean {
  if (data.aiGenerated) return true;
  if ((data.overview || '').trim()) return true;
  if (getIconicSightsItems(data).length) return true;
  if (getFoodDrinkItems(data).length) return true;
  if ((data.drinkItems ?? []).length) return true;
  if ((data.souvenirItems ?? []).length) return true;
  return false;
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


export function linesToCheckItems(text: string): LocationInfoCheckItem[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: LocationInfoCheckItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].replace(/^[-*•]\s*/, '').trim();
    if (!label) continue;
    items.push({ id: `item-${i}-${label.slice(0, 12).replace(/\W/g, '')}`, label, done: false });
  }
  return items;
}

export function checkItemsToText(items: LocationInfoCheckItem[] | undefined): string {
  return (items ?? []).map((x) => x.label).filter(Boolean).join('\n');
}

export function getIconicSightsItems(data: LocationInfoNotes): LocationInfoCheckItem[] {
  if (data.iconicSightsItems !== undefined) return data.iconicSightsItems;
  return linesToCheckItems(data.iconicSights);
}

export function getFoodDrinkItems(data: LocationInfoNotes): LocationInfoCheckItem[] {
  if (data.foodDrinkItems !== undefined) return data.foodDrinkItems;
  return linesToCheckItems(data.foodDrink);
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

export function normalizeLocationInfoNotes(data: LocationInfoNotes): LocationInfoNotes {
  const iconicSightsItems = getIconicSightsItems(data);
  const foodDrinkItems = getFoodDrinkItems(data);
  const drinkItems = data.drinkItems ?? [];
  const souvenirItems = data.souvenirItems ?? [];
  return {
    ...data,
    iconicSightsItems,
    foodDrinkItems,
    drinkItems,
    souvenirItems,
    iconicSights: checkItemsToText(iconicSightsItems),
    foodDrink: checkItemsToText(foodDrinkItems)
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
    aiSightsPlaceholder: 'Add a Gemini API key in Settings to auto-generate highlights, or add items manually.'
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
