import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';

const KEY = 'travelhub-pending-trip-day';

export interface PendingTripDayPayload {
  tripId: string;
  dayId: string;
  calendarYmd?: string;
}

function readPayload(): PendingTripDayPayload | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTripDayPayload;
    if (!parsed.tripId || !parsed.dayId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function peekPendingTripDayPayload(expectedTripId: string): PendingTripDayPayload | null {
  const parsed = readPayload();
  if (!parsed || parsed.tripId !== expectedTripId) return null;
  return parsed;
}

export function peekPendingTripDay(expectedTripId: string): string | null {
  return peekPendingTripDayPayload(expectedTripId)?.dayId ?? null;
}

export function setPendingTripDay(tripId: string, dayId: string, calendarYmd?: string): void {
  try {
    const payload: PendingTripDayPayload = { tripId, dayId };
    if (calendarYmd) payload.calendarYmd = calendarYmd;
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumePendingTripDay(expectedTripId: string, tripDays: TripDay[] = []): string | null {
  const resolved = resolvePendingTripDayId(expectedTripId, tripDays);
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return resolved;
}

/** Match pending day by SharePoint id, then by calendar date within loaded trip days. */
export function resolvePendingTripDayId(expectedTripId: string, tripDays: TripDay[]): string | null {
  const pending = peekPendingTripDayPayload(expectedTripId);
  if (!pending) return null;
  if (pending.dayId && tripDays.some((d) => d.id === pending.dayId)) return pending.dayId;
  const ymd = (pending.calendarYmd || '').slice(0, 10);
  if (ymd) {
    const byDate = tripDays.find((d) => (d.calendarDate || '').slice(0, 10) === ymd);
    if (byDate) return byDate.id;
  }
  return null;
}

export function defaultTripDayId(tripDays: TripDay[]): string | undefined {
  if (!tripDays.length) return undefined;
  const nonPreTrip = tripDays.find((d) => !isPreTripDayRow(d));
  return (nonPreTrip ?? tripDays[0]).id;
}
