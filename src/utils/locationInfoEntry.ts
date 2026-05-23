import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { placeDisplayLabel } from './placeDisplayLabel';
import type { Place } from '../models/Place';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

export const LOCATION_INFO_CATEGORY = 'Location info';

export type LocationInfoNotes = {
  placeId: string;
  overview: string;
  iconicSights: string;
  foodDrink: string;
  practicalTips: string;
  aiSightsPlaceholder?: string;
  aiFoodPlaceholder?: string;
};

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
