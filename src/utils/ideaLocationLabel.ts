import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Place } from '../models/Place';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';

const BROAD_PLACE_LABELS = new Set([
  'europe',
  'asia',
  'africa',
  'americas',
  'north america',
  'south america',
  'scandinavia',
  'world',
  'oceania',
  'antarctica'
]);

export function isBroadPlaceLabel(label: string | undefined): boolean {
  if (!label?.trim()) return true;
  const t = label.trim().toLowerCase();
  if (BROAD_PLACE_LABELS.has(t)) return true;
  if (/^(europe|asia|africa|america|oceania)$/i.test(t)) return true;
  return false;
}

export function placeTitleLabel(place: Place | undefined, day?: TripDay): string | undefined {
  if (place?.title) {
    const country = (place.country || '').trim();
    return country ? `${place.title}, ${country}` : place.title;
  }
  const title = (day?.displayTitle || '').trim();
  return title || undefined;
}

export function itineraryLocationsForDay(dayId: string, entries: ItineraryEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.parentEntryId || e.dayId !== dayId) continue;
    const loc = (e.location || '').trim();
    if (loc) out.push(loc);
    const title = (e.title || '').trim();
    if (title && title !== loc) out.push(title);
  }
  return out;
}

export function resolveDayStopLabel(
  day: TripDay | undefined,
  placeById: (id: string) => Place | undefined,
  itineraryLocations: string[] = [],
  trip?: Trip
): string | undefined {
  if (!day) return undefined;

  if (day.primaryPlaceId) {
    const fromPlace = placeTitleLabel(placeById(day.primaryPlaceId), day);
    if (fromPlace && !isBroadPlaceLabel(fromPlace)) return fromPlace.split(',')[0].trim();
  }

  const dayTitle = (day.displayTitle || '').trim();
  if (dayTitle && !isBroadPlaceLabel(dayTitle)) return dayTitle.split(',')[0].trim();

  for (const loc of itineraryLocations) {
    const short = loc.split(',')[0].trim();
    if (short && !isBroadPlaceLabel(short)) return short;
  }

  const dest = (trip?.destination || '').trim();
  if (dest && !isBroadPlaceLabel(dest)) return dest.split(',')[0].trim();

  return dayTitle || itineraryLocations[0]?.split(',')[0].trim() || undefined;
}

export function resolveIdeaLocationLabel(
  day: TripDay | undefined,
  storedLabel: string | undefined,
  placeById: (id: string) => Place | undefined,
  itineraryLocations: string[] = [],
  tripDestination?: string
): string | undefined {
  const resolved = resolveDayStopLabel(day, placeById, itineraryLocations, {
    destination: tripDestination
  } as Trip);
  if (resolved) return resolved;
  if (storedLabel && !isBroadPlaceLabel(storedLabel)) return storedLabel.split(',')[0].trim();
  return undefined;
}
