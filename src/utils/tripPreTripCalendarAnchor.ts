import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import { DayService } from '../services/DayService';
import { isPreTripDayType } from './itineraryDayEntries';

function ymdSlice(d?: string): string {
  return (d || '').trim().slice(0, 10);
}

/** Calendar day immediately before `ymd` (UTC date math). */
export function calendarDayBefore(ymd: string): string {
  const core = ymdSlice(ymd);
  if (!core) return '';
  const d = new Date(`${core}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return core;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * If the pre-trip TripDay row shares the same calendar date as the first real trip day,
 * accommodation/cruise span logic and legacy totals can leak onto Pre-trip. Move the
 * anchor to the previous calendar day (matches DayService.generateDays behaviour).
 */
export async function repairPreTripCalendarIfCollidingWithFirstDay(
  daySvc: DayService,
  trip: Trip,
  days: TripDay[]
): Promise<TripDay[]> {
  const tid = trip.id;
  const pre = days.find((d) => d.tripId === tid && (d.dayNumber === 0 || isPreTripDayType(d.dayType)));
  const firstReal = days
    .filter((d) => d.tripId === tid && d.dayNumber > 0)
    .sort((a, b) => a.dayNumber - b.dayNumber)[0];
  if (!pre || !firstReal) return days;

  const preCal = ymdSlice(pre.calendarDate);
  const firstCal = ymdSlice(firstReal.calendarDate);
  if (!preCal || !firstCal || preCal !== firstCal) return days;

  const anchor = calendarDayBefore(firstCal);
  if (!anchor || anchor === preCal) return days;

  try {
    await daySvc.update(pre.id, { calendarDate: anchor });
    return days.map((d) => (d.id === pre.id ? { ...d, calendarDate: anchor } : d));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('repairPreTripCalendarIfCollidingWithFirstDay: SP update failed', err);
    return days;
  }
}
