import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { minutesFromTimeStart } from './itineraryTimeUtils';

export function isPreTripDayType(dayType?: string): boolean {
  const normalized = String(dayType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  return normalized === 'pretrip';
}

/** Pre-trip row: explicit type or legacy Day 0 row (some tenants omit / alter DayType). */
export function isPreTripDayRow(day: Pick<TripDay, 'dayNumber' | 'dayType'>): boolean {
  return day.dayNumber === 0 || isPreTripDayType(day.dayType);
}

/** Stable id of the trip's pre-trip day row, if present. */
export function resolvePreTripDayId(tripDays: TripDay[], tripId: string): string | undefined {
  const byType = tripDays.find((d) => d.tripId === tripId && isPreTripDayType(d.dayType));
  if (byType) return byType.id;
  return tripDays.find((d) => d.tripId === tripId && d.dayNumber === 0)?.id;
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

/** Overnight (or late) flight: show the row on the arrival calendar day as well as the departure day. */
export function isFlightArrivalOnCalendarDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Flights' || !entry.arrivalDate || !calendarDate) return false;
  return ymdSlice(entry.arrivalDate) === ymdSlice(calendarDate);
}

function entryHomeCalendarYmd(entry: ItineraryEntry, tripDays: TripDay[] | undefined): string | undefined {
  if (!tripDays?.length) return undefined;
  const row = tripDays.find((d) => d.id === entry.dayId);
  return row?.calendarDate ? ymdSlice(row.calendarDate) : undefined;
}

/**
 * Time string for planner blocks / timeline.
 * Same-calendar-day flights use departure time (`timeStart`); arrival time is used only when the
 * entry's home day differs from the viewed day (overnight leg on the arrival column).
 */
export function effectivePlannerTimeStart(
  entry: ItineraryEntry,
  dayCalendarDate: string,
  tripDays?: TripDay[]
): string {
  if (isTransportReturnOnCalendarDate(entry, dayCalendarDate) && entry.returnTime?.trim()) {
    return entry.returnTime.trim();
  }
  if (
    entry.category === 'Flights' &&
    entry.arrivalTime?.trim() &&
    isFlightArrivalOnCalendarDate(entry, dayCalendarDate)
  ) {
    const viewYmd = ymdSlice(dayCalendarDate);
    const arrYmd = ymdSlice(entry.arrivalDate);
    const homeYmd = entryHomeCalendarYmd(entry, tripDays);
    if (arrYmd === viewYmd && homeYmd && homeYmd !== viewYmd) {
      return entry.arrivalTime.trim();
    }
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
  if (isPreTripDayType(dayType)) return false;
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
  if (isFlightArrivalOnCalendarDate(entry, calendarDate)) {
    return true;
  }
  return false;
}

/** Sort for a single calendar column: saved order first, then time, then title. */
export function compareItineraryEntriesForDisplay(
  calendarDate: string,
  tripDays?: TripDay[]
): (a: ItineraryEntry, b: ItineraryEntry) => number {
  return compareBySortOrderThenTimeForDay(calendarDate, tripDays);
}

function compareBySortOrderThenTimeForDay(
  calendarDate: string,
  tripDays?: TripDay[]
): (a: ItineraryEntry, b: ItineraryEntry) => number {
  return (a, b): number => {
    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    const aMin = minutesFromTimeStart(effectivePlannerTimeStart(a, calendarDate, tripDays));
    const bMin = minutesFromTimeStart(effectivePlannerTimeStart(b, calendarDate, tripDays));
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
  preTripDayId?: string | null,
  /** When DayType is wrong/empty in SharePoint but this row is still the pre-trip day (e.g. DayNumber 0). */
  preTripRowStrict?: boolean,
  /** Resolves each entry's home day calendar date so same-day flights use departure time, not arrival. */
  tripDays?: TripDay[]
): ItineraryEntry[] {
  const hasPreTripId = typeof preTripDayId === 'string' && preTripDayId !== '';
  const spanCtx: EntryCalendarMatchContext | undefined = hasPreTripId
    ? { preTripDayId: preTripDayId as string, viewingDayId: dayId }
    : { viewingDayId: dayId };

  const isStrictDayOnly =
    isPreTripDayType(dayType) || (hasPreTripId && dayId === preTripDayId) || preTripRowStrict === true;

  if (isStrictDayOnly) {
    return entries
      .filter((e) => !e.parentEntryId && e.dayId === dayId)
      .sort(compareBySortOrderThenTimeForDay(calendarDate, tripDays));
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
  return Array.from(map.values()).sort(compareBySortOrderThenTimeForDay(calendarDate, tripDays));
}
