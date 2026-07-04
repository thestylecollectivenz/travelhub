import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TransportTimelineLeg } from './itineraryDayEntries';
import {
  isTransportDepartureOnCalendarDate,
  isTransportReturnOnCalendarDate
} from './itineraryDayEntries';
import type { TripDay } from '../models/TripDay';

export function isReturnTransport(entry: Pick<ItineraryEntry, 'category' | 'journeyType'>): boolean {
  return entry.category === 'Transport' && entry.journeyType === 'return';
}

/** Round-trip total is stored on the card; each leg is half. */
export function transportEachWayAmount(entry: Pick<ItineraryEntry, 'amount' | 'category' | 'journeyType'>): number {
  const total = typeof entry.amount === 'number' && !Number.isNaN(entry.amount) ? entry.amount : 0;
  if (!isReturnTransport(entry) || total <= 0) return total;
  return total / 2;
}

/** Amount to show on a timeline leg card (half for return journeys). */
export function transportLegDisplayAmount(
  entry: Pick<ItineraryEntry, 'amount' | 'category' | 'journeyType'>,
  transportLeg?: TransportTimelineLeg
): number {
  const total = typeof entry.amount === 'number' && !Number.isNaN(entry.amount) ? entry.amount : 0;
  if (!isReturnTransport(entry) || total <= 0) return total;
  if (transportLeg === 'outbound' || transportLeg === 'return') return total / 2;
  return total;
}

/**
 * Day-level split divisor for return transport:
 * - both legs on this day → 1 (full amount once)
 * - only one leg on this day → 2 (half)
 * - not on this day → 0
 */
export function returnTransportDaySplitDivisor(
  entry: ItineraryEntry,
  dayCalendarDate: string | undefined,
  tripDays?: TripDay[]
): number {
  if (!isReturnTransport(entry) || !dayCalendarDate) return 0;
  const outHere = isTransportDepartureOnCalendarDate(entry, dayCalendarDate, tripDays);
  const retHere = isTransportReturnOnCalendarDate(entry, dayCalendarDate);
  if (outHere && retHere) return 1;
  if (outHere || retHere) return 2;
  return 0;
}
