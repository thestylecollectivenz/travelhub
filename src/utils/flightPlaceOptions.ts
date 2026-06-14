import type { Place } from '../models/Place';
import type { TripDay } from '../models/TripDay';
import { placeDisplayLabel } from './placeDisplayLabel';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';
import { isPreTripDayRow } from './itineraryDayEntries';

function addPlaceLabel(names: Set<string>, place: Place | undefined): void {
  if (!place) return;
  const label = placeDisplayLabel(place);
  if (label) names.add(label);
}

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
    addPlaceLabel(names, day.primaryPlaceId ? placeById(day.primaryPlaceId) : undefined);
    for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
      addPlaceLabel(names, placeById(ref.placeId));
    }
  };

  collect(ordered[idx]);
  collect(ordered[idx + 1]);
  return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
