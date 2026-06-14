import type { Place } from '../models/Place';
import type { TripDay } from '../models/TripDay';
import { placeDisplayLabel, formatLocationText } from './placeDisplayLabel';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';
import { isPreTripDayRow } from './itineraryDayEntries';

function addPlaceLabel(names: Set<string>, place: Place | undefined): void {
  if (!place) return;
  const label = placeDisplayLabel(place);
  if (label) names.add(label);
}

/** City, Country labels for location datalists — deduped, sorted, current value first. */
export function buildDayLocationOptions(params: {
  dayId: string;
  tripDays: TripDay[];
  placeById: (id: string) => Place | undefined;
  usedLocations: string[];
  currentLocation?: string;
  /** Flights: include next calendar day places. */
  includeNextDay?: boolean;
}): string[] {
  const { dayId, tripDays, placeById, usedLocations, currentLocation, includeNextDay } = params;
  const names = new Set<string>();

  const ordered = tripDays.filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const idx = ordered.findIndex((d) => d.id === dayId);

  const collectDay = (day: TripDay | undefined): void => {
    if (!day) return;
    addPlaceLabel(names, day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined);
    for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
      addPlaceLabel(names, placeById(ref.placeId));
    }
  };

  if (idx >= 0) {
    collectDay(ordered[idx]);
    if (includeNextDay) collectDay(ordered[idx + 1]);
  } else {
    const day = tripDays.find((d) => d.id === dayId);
    collectDay(day);
  }

  for (const loc of usedLocations) {
    const formatted = formatLocationText(loc);
    if (formatted) names.add(formatted);
  }

  const current = formatLocationText(currentLocation || '');
  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  if (current && sorted.indexOf(current) < 0) {
    return [current, ...sorted];
  }
  if (current) {
    return [current, ...sorted.filter((n) => n !== current)];
  }
  return sorted;
}
