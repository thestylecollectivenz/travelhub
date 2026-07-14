import type { ItineraryEntry } from '../models/ItineraryEntry';
import { isAccommodationNightOnCalendarDate } from './itineraryDayEntries';

function ymdSlice(value: string | undefined): string {
  return (value || '').slice(0, 10);
}

function parseUtcDay(ymd: string): number {
  const t = new Date(`${ymd}T00:00:00.000Z`).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Cruise covers this calendar day (embark through disembark inclusive). */
function cruiseTouchesDay(entry: ItineraryEntry, ymd: string): boolean {
  if (entry.category !== 'Cruise') return false;
  const embark = ymdSlice(entry.embarksDate);
  const disembark = ymdSlice(entry.disembarksDate);
  if (!embark || !disembark) return false;
  const day = parseUtcDay(ymd);
  const start = parseUtcDay(embark);
  const end = parseUtcDay(disembark);
  if (Number.isNaN(day) || Number.isNaN(start) || Number.isNaN(end)) return false;
  return day >= start && day <= end;
}

/** Overnight on ship: embark night through night before disembark. */
function cruiseOvernightOnDay(entry: ItineraryEntry, ymd: string): boolean {
  if (entry.category !== 'Cruise') return false;
  const embark = ymdSlice(entry.embarksDate);
  const disembark = ymdSlice(entry.disembarksDate);
  if (!embark || !disembark) return false;
  const day = parseUtcDay(ymd);
  const start = parseUtcDay(embark);
  const end = parseUtcDay(disembark);
  if (Number.isNaN(day) || Number.isNaN(start) || Number.isNaN(end)) return false;
  return day >= start && day < end;
}

/**
 * Prefer the overnight stay for the day: boarding cruise over finishing cruise,
 * then hotel night.
 */
export function findStayTileForDay(
  entries: ItineraryEntry[],
  calendarDate: string
): { mode: 'accommodation' | 'cruise'; entry: ItineraryEntry } | undefined {
  const ymd = ymdSlice(calendarDate);
  if (!ymd) return undefined;

  const cruises = entries.filter((e) => cruiseTouchesDay(e, ymd));

  // Transition day: embarking ship is tonight's stay, not the finishing cruise.
  const boarding = cruises.find((e) => ymdSlice(e.embarksDate) === ymd);
  if (boarding) return { mode: 'cruise', entry: boarding };

  const overnightCruise = cruises.find((e) => cruiseOvernightOnDay(e, ymd));
  if (overnightCruise) return { mode: 'cruise', entry: overnightCruise };

  const accommodation = entries.find((e) => isAccommodationNightOnCalendarDate(e, calendarDate));
  if (accommodation) return { mode: 'accommodation', entry: accommodation };

  return undefined;
}
