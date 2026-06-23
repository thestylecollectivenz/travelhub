import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { formatActivityScheduleHero } from './activityScheduleLabel';
import { formatCruisePortScheduleHero } from './cruisePlannerUtils';
import { durationFromDateTimes } from './durationFromTimes';
import { formatTimeHHMM, minutesFromTimeStart } from './itineraryTimeUtils';
import { dayHasPlaceId, isLocationInfoEntry, locationInfoPlaceId } from './locationInfoEntry';
import { parseAdditionalPlaceRefs } from './tripDayPlaces';

export type TransportTimelineLeg = 'outbound' | 'return';

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

/** Outbound leg of return transport may use dateStart distinct from the entry home day row. */
export function isTransportDepartureOnCalendarDate(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays?: TripDay[]
): boolean {
  if (entry.category !== 'Transport' || !calendarDate) return false;
  const viewYmd = ymdSlice(calendarDate);
  const depYmd = ymdSlice(entry.dateStart);
  if (depYmd && depYmd === viewYmd) return true;
  if (!tripDays?.length) return false;
  const home = tripDays.find((d) => d.id === entry.dayId);
  return home ? ymdSlice(home.calendarDate) === viewYmd : false;
}

/** Overnight (or late) flight: show the row on the arrival calendar day as well as the departure day. */
export function isFlightArrivalOnCalendarDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Flights' || !entry.arrivalDate || !calendarDate) return false;
  return ymdSlice(entry.arrivalDate) === ymdSlice(calendarDate);
}

/** Multi-day flights also appear on calendar days between departure and arrival. */
export function isFlightInTransitOnCalendarDate(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays?: TripDay[]
): boolean {
  if (entry.category !== 'Flights' || !calendarDate) return false;
  const viewYmd = ymdSlice(calendarDate);
  const depYmd = ymdSlice(entry.dateStart || entryHomeCalendarYmd(entry, tripDays));
  const arrYmd = ymdSlice(entry.arrivalDate || depYmd);
  if (!depYmd || !arrYmd || depYmd === arrYmd) return false;
  return viewYmd > depYmd && viewYmd < arrYmd;
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
    entry.category === 'Accommodation' &&
    isAccommodationCheckoutOnCalendarDate(entry, dayCalendarDate) &&
    entry.checkOutTime?.trim()
  ) {
    return entry.checkOutTime.trim();
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

function accommodationNights(entry: ItineraryEntry): number {
  if (!entry.dateStart || !entry.dateEnd) return 0;
  const start = new Date(`${entry.dateStart}T00:00:00.000Z`);
  const end = new Date(`${entry.dateEnd}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

/** Guest is staying this night (check-in day through night before check-out). */
export function isAccommodationNightOnCalendarDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Accommodation' || !entry.dateStart || !entry.dateEnd || !calendarDate) return false;
  const day = new Date(`${ymdSlice(calendarDate)}T00:00:00.000Z`);
  const start = new Date(`${ymdSlice(entry.dateStart)}T00:00:00.000Z`);
  const end = new Date(`${ymdSlice(entry.dateEnd)}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
}

/** Check-out morning only (not an overnight night). */
export function isAccommodationCheckoutOnCalendarDate(entry: ItineraryEntry, calendarDate: string): boolean {
  if (entry.category !== 'Accommodation' || !entry.dateEnd || !calendarDate) return false;
  return ymdSlice(entry.dateEnd) === ymdSlice(calendarDate);
}

export function isEntryOnCalendarDate(
  entry: ItineraryEntry,
  calendarDate: string,
  dayType?: string,
  ctx?: EntryCalendarMatchContext,
  tripDays?: TripDay[]
): boolean {
  if (isPreTripDayType(dayType)) return false;
  if (ctx?.preTripDayId && ctx?.viewingDayId && ctx.viewingDayId === ctx.preTripDayId) {
    return false;
  }
  if (!calendarDate) return false;
  if (entry.category === 'Accommodation' && entry.dateStart && entry.dateEnd) {
    if (isAccommodationNightOnCalendarDate(entry, calendarDate)) return true;
    return isAccommodationCheckoutOnCalendarDate(entry, calendarDate);
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
  if (isFlightInTransitOnCalendarDate(entry, calendarDate, tripDays)) {
    return true;
  }
  return false;
}

/** Sort for a single calendar column: checkout top, timed chronology, untimed bottom; sortOrder breaks ties. */
export function compareItineraryEntriesForDisplay(
  calendarDate: string,
  tripDays?: TripDay[]
): (a: ItineraryEntry, b: ItineraryEntry) => number {
  return compareBySortOrderThenTimeForDay(calendarDate, tripDays);
}

/** Return transport row on the return calendar day when outbound is on another day. */
export function isTransportReturnCarryoverOnDay(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays?: TripDay[]
): boolean {
  return (
    entry.category === 'Transport' &&
    entry.journeyType === 'return' &&
    isTransportReturnOnCalendarDate(entry, calendarDate) &&
    !isTransportDepartureOnCalendarDate(entry, calendarDate, tripDays)
  );
}

export function transportLegDurationLabel(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[] | undefined,
  leg?: TransportTimelineLeg
): string {
  const isReturnLeg =
    leg === 'return' ||
    (!leg && isTransportReturnOnCalendarDate(entry, calendarDate));
  if (isReturnLeg && entry.journeyType === 'return') {
    return (
      durationFromDateTimes({
        startDate: entry.returnDate,
        startTime: entry.returnTime,
        endDate: entry.returnDate,
        endTime: entry.returnArrivalTime
      }) || ''
    );
  }
  const d = entry.duration?.trim() ?? '';
  if (!d || /^\d+(\.\d+)?$/.test(d)) return '';
  return d;
}

/** Prominent schedule line for transport cards and previews (departure, duration, arrival). */
export function formatTransportScheduleHero(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[] | undefined,
  leg?: TransportTimelineLeg
): string | null {
  if (entry.category !== 'Transport') return null;
  const isReturnLeg =
    leg === 'return' ||
    (!leg && isTransportReturnOnCalendarDate(entry, calendarDate));
  if (isReturnLeg && entry.journeyType === 'return') {
    const dep = formatTimeHHMM(entry.returnTime || '');
    const arr = formatTimeHHMM(entry.returnArrivalTime || '');
    const dur = transportLegDurationLabel(entry, calendarDate, tripDays, 'return');
    const parts: string[] = [];
    if (dep) parts.push(`Departs ${dep}`);
    if (dur) parts.push(dur);
    if (arr) parts.push(`Arrives ${arr}`);
    return parts.length ? parts.join(' · ') : null;
  }
  const dep = formatTimeHHMM(entry.timeStart || '');
  const arr = formatTimeHHMM(entry.arrivalTime || '');
  const dur = transportLegDurationLabel(entry, calendarDate, tripDays, 'outbound');
  const parts: string[] = [];
  if (dep) parts.push(`Departs ${dep}`);
  if (dur) parts.push(dur);
  if (arr) parts.push(`Arrives ${arr}`);
  return parts.length ? parts.join(' · ') : null;
}

function humanDurationLabel(duration?: string): string {
  const d = (duration || '').trim();
  if (!d || /^\d+(\.\d+)?$/.test(d)) return '';
  return d;
}

/** Prominent schedule line for any itinerary card / planner block. */
export function formatEntryScheduleHero(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[] | undefined,
  options?: { transportLeg?: TransportTimelineLeg; subItem?: ItinerarySubItem; allEntries?: ItineraryEntry[] }
): string | null {
  const sub = options?.subItem;
  if (sub) {
    return formatActivityScheduleHero({
      calendarDate,
      timeStart: sub.startTime,
      duration: sub.duration,
      arrivalTime: sub.endTime
    });
  }

  if (entry.category === 'Transport') {
    return formatTransportScheduleHero(entry, calendarDate, tripDays, options?.transportLeg);
  }

  if (entry.category === 'Activities') {
    return formatActivityScheduleHero({
      calendarDate,
      timeStart: entry.timeStart,
      duration: entry.duration,
      arrivalTime: entry.arrivalTime
    });
  }

  if (entry.category === 'Flights') {
    const dep = formatTimeHHMM(entry.timeStart || '');
    const arr = formatTimeHHMM(entry.arrivalTime || '');
    const dur = humanDurationLabel(entry.duration);
    const parts: string[] = [];
    if (dep) parts.push(`Departs ${dep}`);
    if (dur) parts.push(dur);
    if (arr) parts.push(`Arrives ${arr}`);
    return parts.length ? parts.join(' · ') : null;
  }

  if (entry.category === 'Accommodation' && entry.dateStart && entry.dateEnd) {
    const cal = ymdSlice(calendarDate);
    const start = ymdSlice(entry.dateStart);
    const end = ymdSlice(entry.dateEnd);
    const nights = accommodationNights(entry);
    if (cal > start && cal < end) {
      const thisDay = new Date(`${cal}T00:00:00.000Z`);
      const startDay = new Date(`${start}T00:00:00.000Z`);
      const nightNum = Math.floor((thisDay.getTime() - startDay.getTime()) / 86400000) + 1;
      return nights > 0 ? `Night ${nightNum} of ${nights}` : null;
    }
    if (cal === start && entry.checkInTime?.trim()) {
      const checkIn = formatTimeHHMM(entry.checkInTime);
      return nights > 0 ? `Check-in ${checkIn} · ${nights} night${nights === 1 ? '' : 's'}` : `Check-in ${checkIn}`;
    }
    if (cal === end) {
      if (entry.checkOutTime?.trim()) {
        return `Check-out ${formatTimeHHMM(entry.checkOutTime)}`;
      }
      return 'Check-out';
    }
    if (cal === start && !entry.checkInTime?.trim() && nights > 0) {
      return `${nights} night${nights === 1 ? '' : 's'}`;
    }
    return null;
  }

  if (entry.category === 'Cruise' && entry.embarksDate && entry.disembarksDate) {
    const cal = ymdSlice(calendarDate);
    const embark = ymdSlice(entry.embarksDate);
    const disembark = ymdSlice(entry.disembarksDate);
    const startDay = new Date(`${embark}T00:00:00.000Z`);
    const endDay = new Date(`${disembark}T00:00:00.000Z`);
    const thisDay = new Date(`${cal}T00:00:00.000Z`);
    const totalDays =
      !Number.isNaN(startDay.getTime()) && !Number.isNaN(endDay.getTime())
        ? Math.max(1, Math.floor((endDay.getTime() - startDay.getTime()) / 86400000) + 1)
        : 0;
    if (cal > embark && cal < disembark && totalDays > 0) {
      const dayNum = Math.floor((thisDay.getTime() - startDay.getTime()) / 86400000) + 1;
      return `Day ${dayNum} of ${totalDays}`;
    }
    if (cal === embark && entry.timeStart?.trim()) {
      return `Embarks ${formatTimeHHMM(entry.timeStart)}`;
    }
    if (cal === disembark && entry.arrivalTime?.trim()) {
      return `Disembarks ${formatTimeHHMM(entry.arrivalTime)}`;
    }
    return totalDays > 0 ? `${totalDays} day${totalDays === 1 ? '' : 's'}` : null;
  }

  if (entry.category === 'Cruise port') {
    if (tripDays?.length && options?.allEntries?.length) {
      return formatCruisePortScheduleHero(entry, calendarDate, tripDays, options.allEntries);
    }
    const arrive = formatTimeHHMM(entry.timeStart || '');
    const depart = formatTimeHHMM(entry.arrivalTime || '');
    const parts: string[] = [];
    if (arrive) parts.push(`Arrives ${arrive}`);
    if (depart) parts.push(`Departs ${depart}`);
    return parts.length ? parts.join(' · ') : null;
  }

  if (entry.category === 'Cruise at sea') {
    return 'At sea';
  }

  if (entry.category === 'Food & Dining' || entry.category === 'Preparation') {
    return formatActivityScheduleHero({
      calendarDate,
      timeStart: entry.timeStart,
      duration: entry.duration,
      arrivalTime: entry.arrivalTime
    });
  }

  if (entry.category === 'Travel Overheads') {
    const when = formatTimeHHMM(entry.timeStart || '');
    if (when) return when;
    const dur = humanDurationLabel(entry.duration);
    return dur || null;
  }

  if (entry.category === 'Location info') {
    return null;
  }

  if (entry.category === 'Other') {
    return formatActivityScheduleHero({
      calendarDate,
      timeStart: entry.timeStart,
      duration: entry.duration,
      arrivalTime: entry.arrivalTime
    });
  }

  const dep = formatTimeHHMM(effectivePlannerTimeStart(entry, calendarDate, tripDays));
  const dur = humanDurationLabel(entry.duration);
  const arr = formatTimeHHMM(entry.arrivalTime || '');
  const parts: string[] = [];
  if (dep) parts.push(`Departs ${dep}`);
  if (dur) parts.push(dur);
  if (arr) parts.push(`Arrives ${arr}`);
  return parts.length ? parts.join(' · ') : null;
}

function compareBySortOrderThenTimeForDay(
  calendarDate: string,
  tripDays?: TripDay[]
): (a: ItineraryEntry, b: ItineraryEntry) => number {
  return (a, b): number => {
    const aCheckout =
      a.category === 'Accommodation' && isAccommodationCheckoutOnCalendarDate(a, calendarDate);
    const bCheckout =
      b.category === 'Accommodation' && isAccommodationCheckoutOnCalendarDate(b, calendarDate);
    if (aCheckout !== bCheckout) return aCheckout ? -1 : 1;

    const aCont = isMultiDayContinuationOnDay(a, calendarDate, tripDays);
    const bCont = isMultiDayContinuationOnDay(b, calendarDate, tripDays);
    if (aCont !== bCont) return aCont ? 1 : -1;

    const aCarry = isTransportReturnCarryoverOnDay(a, calendarDate, tripDays);
    const bCarry = isTransportReturnCarryoverOnDay(b, calendarDate, tripDays);
    if (aCarry || bCarry) {
      const aMin = minutesFromTimeStart(effectivePlannerTimeStart(a, calendarDate, tripDays));
      const bMin = minutesFromTimeStart(effectivePlannerTimeStart(b, calendarDate, tripDays));
      if (aMin !== undefined && bMin !== undefined && aMin !== bMin) return aMin - bMin;
      if (aMin !== undefined && bMin === undefined) return -1;
      if (aMin === undefined && bMin !== undefined) return 1;
    }

    const aMin = minutesFromTimeStart(effectivePlannerTimeStart(a, calendarDate, tripDays));
    const bMin = minutesFromTimeStart(effectivePlannerTimeStart(b, calendarDate, tripDays));
    const aHasTime = aMin !== undefined;
    const bHasTime = bMin !== undefined;
    if (aHasTime !== bHasTime) return aHasTime ? -1 : 1;
    if (aHasTime && bHasTime && aMin !== bMin) return aMin - bMin;

    const ao = a.sortOrder ?? 0;
    const bo = b.sortOrder ?? 0;
    if (ao !== bo) return ao - bo;
    return (a.title || '').localeCompare(b.title || '');
  };
}

function isMultiDaySpanCategory(category: string): boolean {
  return category === 'Accommodation' || category === 'Cruise';
}

/** Hotel / cruise continuation rows on later days — default to bottom of the column. */
function isMultiDayContinuationOnDay(entry: ItineraryEntry, calendarDate: string, tripDays?: TripDay[]): boolean {
  if (entry.category === 'Accommodation' && isAccommodationCheckoutOnCalendarDate(entry, calendarDate)) {
    return false;
  }
  if (!isMultiDaySpanCategory(entry.category) || !tripDays?.length) return false;
  const homeDay = tripDays.find((d) => d.id === entry.dayId);
  if (!homeDay) return false;
  const homeCal = homeDay.calendarDate.slice(0, 10);
  const viewCal = calendarDate.slice(0, 10);
  if (viewCal <= homeCal) return false;
  return isEntryOnCalendarDate(entry, calendarDate, homeDay.dayType, { viewingDayId: homeDay.id }, tripDays);
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
    if (e.dayId === dayId || isEntryOnCalendarDate(e, calendarDate, dayType, spanCtx, tripDays)) {
      map.set(e.id, e);
    }
  }
  for (const e of entries) {
    if (e.parentEntryId) continue;
    if (!calendarDate) continue;
    if (isTransportReturnOnCalendarDate(e, calendarDate) && !map.has(e.id)) {
      map.set(e.id, e);
    }
    if (isTransportDepartureOnCalendarDate(e, calendarDate, tripDays) && !map.has(e.id)) {
      map.set(e.id, e);
    }
  }

  const dayRow = tripDays?.find((d) => d.id === dayId);
  if (dayRow) {
    for (const e of entries) {
      if (!isLocationInfoEntry(e) || e.parentEntryId) continue;
      const pid = locationInfoPlaceId(e);
      if (!pid) continue;
      if (dayHasPlaceId(dayRow, pid, () => undefined) || collectPlaceIdsOnDay(dayRow).indexOf(pid) >= 0) {
        map.set(e.id, e);
      }
    }
  }

  return Array.from(map.values()).sort(compareLocationInfoFirst(calendarDate, tripDays));
}

export interface TimelineDisplayRow {
  key: string;
  entry: ItineraryEntry;
  transportLeg?: TransportTimelineLeg;
}

/** Split return transport into separate outbound/return timeline rows when both legs fall on this day. */
export function expandTimelineDisplayRows(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays?: TripDay[]
): TimelineDisplayRow[] {
  const rows: TimelineDisplayRow[] = [];
  for (const entry of entries) {
    if (entry.category === 'Transport' && entry.journeyType === 'return') {
      const retHere = isTransportReturnOnCalendarDate(entry, calendarDate);
      const outHere = isTransportDepartureOnCalendarDate(entry, calendarDate, tripDays);
      if (outHere && retHere) {
        rows.push({ key: `${entry.id}-outbound`, entry, transportLeg: 'outbound' });
        rows.push({ key: `${entry.id}-return`, entry, transportLeg: 'return' });
        continue;
      }
      if (outHere) {
        rows.push({ key: `${entry.id}-outbound`, entry, transportLeg: 'outbound' });
        continue;
      }
      if (retHere) {
        rows.push({ key: `${entry.id}-return`, entry, transportLeg: 'return' });
        continue;
      }
    }
    rows.push({ key: entry.id, entry });
  }
  return rows;
}

export function effectiveTransportLegTime(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[] | undefined,
  leg?: TransportTimelineLeg
): string {
  if (leg === 'return' && entry.returnTime?.trim()) return entry.returnTime.trim();
  if (leg === 'outbound' && entry.timeStart?.trim()) return entry.timeStart.trim();
  return effectivePlannerTimeStart(entry, calendarDate, tripDays);
}

function collectPlaceIdsOnDay(day: TripDay): string[] {
  const ids: string[] = [];
  if (day.primaryPlaceId) ids.push(day.primaryPlaceId);
  for (const ref of parseAdditionalPlaceRefs(day.additionalPlaceIds)) {
    ids.push(ref.placeId);
  }
  return ids;
}

function compareLocationInfoFirst(
  calendarDate: string,
  tripDays?: TripDay[]
): (a: ItineraryEntry, b: ItineraryEntry) => number {
  const base = compareBySortOrderThenTimeForDay(calendarDate, tripDays);
  return (a, b) => {
    const aLoc = isLocationInfoEntry(a) ? 0 : 1;
    const bLoc = isLocationInfoEntry(b) ? 0 : 1;
    if (aLoc !== bLoc) return aLoc - bLoc;
    return base(a, b);
  };
}
