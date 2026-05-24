import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

/** Visual Crossing timeline forecast horizon from today. */
export const MAX_FORECAST_DAYS = 15;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** All calendar dates (sorted) where a place is primary or additional on a trip day. */
export function datesWherePlaceAppears(tripDays: TripDay[], placeId: string): string[] {
  if (!placeId) return [];
  const dates: string[] = [];
  for (const day of tripDays) {
    if (isPreTripDayRow(day)) continue;
    const ymd = (day.calendarDate || '').slice(0, 10);
    if (!ymd) continue;
    if (day.primaryPlaceId === placeId) {
      dates.push(ymd);
      continue;
    }
    for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
      if (ref.placeId === placeId) {
        dates.push(ymd);
        break;
      }
    }
  }
  dates.sort();
  const unique: string[] = [];
  for (let i = 0; i < dates.length; i++) {
    if (unique.indexOf(dates[i]) < 0) unique.push(dates[i]);
  }
  return unique;
}

/**
 * Forecast strip from actual today forward (not trip calendar dates).
 * Box count follows how many days this place appears on the trip, capped at MAX_FORECAST_DAYS.
 */
export function forecastDatesForPlaceStay(stayDates: string[], today = todayYmd()): string[] {
  const stayCount = stayDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).length;
  const count = Math.max(1, Math.min(MAX_FORECAST_DAYS, stayCount > 0 ? stayCount : MAX_FORECAST_DAYS));
  const out: string[] = [];
  let cursor = today;
  for (let i = 0; i < count; i++) {
    out.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return out;
}

export function forecastDayLabelFromToday(date: string, today = todayYmd()): string {
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(t.getTime())) {
    return d.toLocaleDateString('en-NZ', { weekday: 'short' });
  }
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-NZ', { weekday: 'short' });
}
