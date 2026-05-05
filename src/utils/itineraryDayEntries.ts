import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { minutesFromTimeStart } from './itineraryTimeUtils';

/** Stable id of the trip's pre-trip day row, if present. */
export function resolvePreTripDayId(tripDays: TripDay[], tripId: string): string | undefined {
  return tripDays.find((d) => d.tripId === tripId && (d.dayType === 'PreTrip' || String(d.dayType) === 'Pre-trip'))?.id;
}

function ymdSlice(d?: string): string {
  if (!d) return '';
  return d.slice(0, 10);
}

/** Transport return leg appears on the return calendar day (same list row as outbound). */
export function isTransportReturnOnCalendarDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Transport' || entry.journeyType !== 'return' || !entry.returnDate || !calendarDate) {
    return false;
  }
  return ymdSlice(entry.returnDate) === ymdSlice(calendarDate);
}

/** Time string used for planner column / timeline when showing the return leg. */
export function effectivePlannerTimeStart(entry: ItineraryEntry, dayCalendarDate: string): string {
  if (isTransportReturnOnCalendarDate(entry, dayCalendarDate) && entry.returnTime?.trim()) {
    return entry.returnTime.trim();
  }
  return entry.timeStart || '';
}

export type EntryCalendarMatchContext = {
  /** Trip pre-trip day row id — span/carryover must never attach entries to this day. */
  preTripDayId?: string;
  /** The day row id currently being rendered. */
  viewingDayId?: string;
};

export function isEntryOnCalendarDate(
  entry: ItineraryEntry,
  calendarDate: string,
  dayType?: string,
  ctx?: EntryCalendarMatchContext
): boolean {
  if (dayType === 'PreTrip' || dayType === 'Pre-trip') return false;
  if (ctx?.preTripDayId && ctx?.viewingDayId && ctx.viewingDayId === ctx.preTripDayId) {
    return false;
  }
  if (!calendarDate) return false;
  if (entry.category === 'Accommodation' && entry.dateStart && entry.dateEnd) {
    const day = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
    const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
  }
  if (entry.category === 'Cruise' && entry.embarksDate && entry.disembarksDate) {
    const day = new Date(`${calendarDate}T00:00:00.000Z`);
    const start = new Date(`${entry.embarksDate}T00:00:00.000Z`);
    const end = new Date(`${entry.disembarksDate}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
  }
  return false;
}

function compareBySortOrderThenTimeForDay(calendarDate: string): (a: ItineraryEntry, b: ItineraryEntry) => number {
  return (a, b): number => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    const aMin = minutesFromTimeStart(effectivePlannerTimeStart(a, calendarDate));
    const bMin = minutesFromTimeStart(effectivePlannerTimeStart(b, calendarDate));
    if (aMin !== undefined && bMin !== undefined) return aMin - bMin;
    if (aMin !== undefined) return -1;
    if (bMin !== undefined) return 1;
    return (a.title || '').localeCompare(b.title || '');
  };
}

/**
 * @param preTripDayId Optional stable id of the trip's pre-trip day — when `dayId` matches, only direct `dayId` rows are shown; span logic is skipped even if `dayType` is wrong in data.
 */
export function sortEntriesForDay(
  entries: ItineraryEntry[],
  dayId: string,
  calendarDate: string,
  dayType?: string,
  preTripDayId?: string | null
): ItineraryEntry[] {
  const hasPreTripId = typeof preTripDayId === 'string' && preTripDayId !== '';
  const spanCtx: EntryCalendarMatchContext | undefined = hasPreTripId
    ? { preTripDayId: preTripDayId as string, viewingDayId: dayId }
    : { viewingDayId: dayId };

  const isStrictDayOnly =
    dayType === 'PreTrip' || dayType === 'Pre-trip' || (hasPreTripId && dayId === preTripDayId);

  if (isStrictDayOnly) {
    return entries
      .filter((e) => !e.parentEntryId && e.dayId === dayId)
      .sort(compareBySortOrderThenTimeForDay(calendarDate));
  }

  const map = new Map<string, ItineraryEntry>();
  for (const e of entries) {
    if (e.parentEntryId) continue;
    if (e.dayId === dayId || isEntryOnCalendarDate(e, calendarDate, dayType, spanCtx)) {
      map.set(e.id, e);
    }
  }
  for (const e of entries) {
    if (e.parentEntryId) continue;
    if (!calendarDate) continue;
    if (isTransportReturnOnCalendarDate(e, calendarDate) && !map.has(e.id)) {
      map.set(e.id, e);
    }
  }
  return Array.from(map.values()).sort(compareBySortOrderThenTimeForDay(calendarDate));
}
