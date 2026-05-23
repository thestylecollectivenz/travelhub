import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';

/** Calendar dates (YYYY-MM-DD) for consecutive days sharing the same primary place as anchorDay. */
export function consecutivePrimaryPlaceDates(
  tripDays: TripDay[],
  anchorDayId: string,
  placeId: string
): string[] {
  const ordered = tripDays.filter((d) => !isPreTripDayRow(d)).sort((a, b) => a.dayNumber - b.dayNumber);
  const idx = ordered.findIndex((d) => d.id === anchorDayId);
  if (idx < 0) return [];

  let start = idx;
  let end = idx;
  while (start > 0 && ordered[start - 1].primaryPlaceId === placeId) {
    start -= 1;
  }
  while (end < ordered.length - 1 && ordered[end + 1].primaryPlaceId === placeId) {
    end += 1;
  }

  return ordered
    .slice(start, end + 1)
    .map((d) => (d.calendarDate || '').slice(0, 10))
    .filter(Boolean);
}

export function forecastDayLabel(anchorDate: string, date: string): string {
  const a = new Date(`${anchorDate}T12:00:00`);
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-NZ', { weekday: 'short' });
  }
  const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-NZ', { weekday: 'short' });
}
