import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';
import { isPreTripDayRow } from './itineraryDayEntries';

/** Place names for the entry day and the next calendar day (overnight flights). */
export function flightPlaceOptionsForDay(
  dayId: string,
  tripDays: TripDay[],
  placeById: (id: string) => Place | undefined
): string[] {
  const ordered = tripDays.filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const idx = ordered.findIndex((d) => d.id === dayId);
  if (idx < 0) return [];

  const names = new Set<string>();
  const collect = (day: TripDay | undefined): void => {
    if (!day) return;
    const primary = day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined;
    if (primary?.title?.trim()) names.add(primary.title.trim());
    for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
      const p = placeById(ref.placeId);
      if (p?.title?.trim()) names.add(p.title.trim());
    }
  };

  collect(ordered[idx]);
  collect(ordered[idx + 1]);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
