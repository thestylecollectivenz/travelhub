import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { compareItineraryEntriesForDisplay } from './itineraryDayEntries';

function storageKey(tripId: string, viewDayId: string): string {
  return `travelHub.dayColumnOrder.${tripId}.${viewDayId}`;
}

/** Persist the visual order of itinerary cards for one trip day column (includes carryovers). */
export function saveDayViewEntryOrder(tripId: string, viewDayId: string, orderedIds: string[]): void {
  try {
    window.localStorage.setItem(storageKey(tripId, viewDayId), JSON.stringify(orderedIds));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Apply a saved per-column order (drag-drop) on top of the default sort for that calendar column.
 * Entries not listed in storage are appended in default (time / sortOrder) order.
 */
export function applyDayViewEntryOrder(
  tripId: string,
  viewDayId: string,
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays?: TripDay[]
): ItineraryEntry[] {
  let rawIds: string[] = [];
  try {
    const s = window.localStorage.getItem(storageKey(tripId, viewDayId));
    if (s) rawIds = JSON.parse(s) as string[];
  } catch {
    rawIds = [];
  }
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return entries;
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  const used = new Set<string>();
  const out: ItineraryEntry[] = [];
  for (const id of rawIds) {
    const e = byId.get(id);
    if (e) {
      out.push(e);
      used.add(e.id);
    }
  }
  const rest = entries.filter((e) => !used.has(e.id)).sort(compareItineraryEntriesForDisplay(calendarDate, tripDays));
  return [...out, ...rest];
}
