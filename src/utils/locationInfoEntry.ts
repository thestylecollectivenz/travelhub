import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { placeDisplayLabel } from './placeDisplayLabel';
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
};

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
    aiSightsPlaceholder: 'AI: iconic sights and must-see spots (coming soon)',
    aiFoodPlaceholder: 'AI: food, drink and local favourites (coming soon)'
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
