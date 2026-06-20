import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { compareItineraryEntriesForDisplay, sortEntriesForDay } from './itineraryDayEntries';

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

/** Insert an entry into saved column order by time when it is not already listed (e.g. return transport leg). */
export function insertEntryInDayViewOrderByTime(
  tripId: string,
  viewDayId: string,
  entryId: string,
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays?: TripDay[],
  dayType?: string,
  preTripDayId?: string | null,
  preTripRowStrict?: boolean
): void {
  let rawIds: string[] = [];
  try {
    const s = window.localStorage.getItem(storageKey(tripId, viewDayId));
    if (s) rawIds = JSON.parse(s) as string[];
  } catch {
    rawIds = [];
  }
  if (Array.isArray(rawIds) && rawIds.indexOf(entryId) >= 0) return;

  const sorted = sortEntriesForDay(
    entries,
    viewDayId,
    calendarDate,
    dayType,
    preTripDayId,
    preTripRowStrict,
    tripDays
  );
  saveDayViewEntryOrder(tripId, viewDayId, sorted.map((e) => e.id));
}

/** Collapse expanded timeline rows to unique entries in visual order. */
export function entriesFromTimelineRowOrder(
  rows: Array<{ entry: ItineraryEntry }>
): ItineraryEntry[] {
  const seen = new Set<string>();
  const out: ItineraryEntry[] = [];
  for (const row of rows) {
    if (!seen.has(row.entry.id)) {
      seen.add(row.entry.id);
      out.push(row.entry);
    }
  }
  return out;
}

/** Strip outbound/return suffix from a timeline sortable id. */
export function timelineRowKeyToEntryId(rowKey: string): string {
  return rowKey.replace(/-(outbound|return)$/, '');
}

function readDayViewEntryOrder(tripId: string, viewDayId: string): string[] {
  try {
    const s = window.localStorage.getItem(storageKey(tripId, viewDayId));
    if (!s) return [];
    const rawIds = JSON.parse(s) as string[];
    return Array.isArray(rawIds) ? rawIds : [];
  } catch {
    return [];
  }
}

/** Insert a new card id immediately after another in a saved column order (duplicate). */
export function insertAfterInDayViewEntryOrder(
  tripId: string,
  viewDayId: string,
  afterId: string,
  newId: string,
  /** Seed order when nothing saved yet (current visible card ids). */
  fallbackOrderedIds?: string[]
): void {
  let rawIds = readDayViewEntryOrder(tripId, viewDayId);
  if (rawIds.length === 0 && fallbackOrderedIds && fallbackOrderedIds.length > 0) {
    rawIds = [...fallbackOrderedIds];
  }
  if (rawIds.length === 0) return;
  if (rawIds.indexOf(newId) >= 0) {
    saveDayViewEntryOrder(tripId, viewDayId, rawIds);
    return;
  }
  const idx = rawIds.indexOf(afterId);
  const next = [...rawIds];
  if (idx < 0) {
    next.push(newId);
  } else {
    next.splice(idx + 1, 0, newId);
  }
  saveDayViewEntryOrder(tripId, viewDayId, next);
}

/** Swap a pending id for the persisted SharePoint id in saved column order. */
export function replaceIdInDayViewEntryOrder(
  tripId: string,
  viewDayId: string,
  fromId: string,
  toId: string
): void {
  const rawIds = readDayViewEntryOrder(tripId, viewDayId);
  if (rawIds.length === 0) return;
  const idx = rawIds.indexOf(fromId);
  if (idx < 0) return;
  const next = [...rawIds];
  next[idx] = toId;
  saveDayViewEntryOrder(tripId, viewDayId, next);
}

/** Remove an id from saved column order (rollback). */
export function removeFromDayViewEntryOrder(tripId: string, viewDayId: string, entryId: string): void {
  const rawIds = readDayViewEntryOrder(tripId, viewDayId);
  if (rawIds.length === 0) return;
  const next = rawIds.filter((id) => id !== entryId);
  if (next.length === rawIds.length) return;
  saveDayViewEntryOrder(tripId, viewDayId, next);
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
