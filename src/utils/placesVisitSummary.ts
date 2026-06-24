import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import type { Place } from '../models/Place';
import { placeDisplayLabel } from './placeDisplayLabel';
import { isPreTripDayRow } from './itineraryDayEntries';

export interface PlaceVisitRow {
  label: string;
  dayNumbers: number[];
  entryCount: number;
}

export function buildPlacesVisitSummary(
  tripDays: TripDay[],
  entries: ItineraryEntry[],
  placeById: (id: string) => Place | undefined
): { uniquePlaces: number; rows: PlaceVisitRow[] } {
  const map = new Map<string, { label: string; dayNumbers: Set<number>; entryCount: number }>();

  const add = (label: string, dayNumber: number, entryBump = 0): void => {
    const key = label.trim().toLowerCase();
    if (!key) return;
    const row = map.get(key) ?? { label: label.trim(), dayNumbers: new Set<number>(), entryCount: 0 };
    if (dayNumber > 0) row.dayNumbers.add(dayNumber);
    row.entryCount += entryBump;
    map.set(key, row);
  };

  for (const day of tripDays) {
    if (isPreTripDayRow(day)) continue;
    if (day.primaryPlaceId) {
      const place = placeById(day.primaryPlaceId);
      add(place ? placeDisplayLabel(place) : day.displayTitle || 'Place', day.dayNumber);
    } else if (day.displayTitle?.trim()) {
      add(day.displayTitle.trim(), day.dayNumber);
    }
  }

  for (const entry of entries) {
    const day = tripDays.find((d) => d.id === entry.dayId);
    const dayNum = day && !isPreTripDayRow(day) ? day.dayNumber : 0;
    const loc = (entry.location || '').trim();
    if (loc) add(loc, dayNum, 1);
    for (const sub of entry.subItems ?? []) {
      const subLoc = (sub.location || '').trim();
      if (subLoc) add(subLoc, dayNum, 1);
    }
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      label: r.label,
      dayNumbers: Array.from(r.dayNumbers).sort((a, b) => a - b),
      entryCount: r.entryCount
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { uniquePlaces: rows.length, rows };
}
