import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import {
  compareItineraryEntriesForDisplay,
  expandTimelineDisplayRows,
  isEntryOnCalendarDate,
  isPreTripDayRow,
  resolvePreTripDayId,
  sortEntriesForDay
} from './itineraryDayEntries';

function storageKey(tripId: string, viewDayId: string): string {
  return `travelHub.dayColumnOrder.${tripId}.${viewDayId}`;
}

function timelineRowStorageKey(tripId: string, viewDayId: string): string {
  return `travelHub.dayTimelineRowOrder.${tripId}.${viewDayId}`;
}

/** Persist visual order of expanded timeline rows (supports outbound/return legs separately). */
export function saveDayViewTimelineRowOrder(tripId: string, viewDayId: string, rowKeys: string[]): void {
  try {
    window.localStorage.setItem(timelineRowStorageKey(tripId, viewDayId), JSON.stringify(rowKeys));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Apply saved timeline row order after expandTimelineDisplayRows. */
export function applyDayViewTimelineRowOrder<T extends { key: string }>(
  tripId: string,
  viewDayId: string,
  rows: T[]
): T[] {
  let rawKeys: string[] = [];
  try {
    const s = window.localStorage.getItem(timelineRowStorageKey(tripId, viewDayId));
    if (s) rawKeys = JSON.parse(s) as string[];
  } catch {
    rawKeys = [];
  }
  if (!Array.isArray(rawKeys) || rawKeys.length === 0) return rows;

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const used = new Set<string>();
  const out: T[] = [];
  for (const key of rawKeys) {
    const row = byKey.get(key);
    if (row) {
      out.push(row);
      used.add(key);
    }
  }
  for (const row of rows) {
    if (!used.has(row.key)) out.push(row);
  }
  return out;
}

/** Persist the visual order of itinerary cards for one trip day column (includes carryovers). */
export function saveDayViewEntryOrder(tripId: string, viewDayId: string, orderedIds: string[]): void {
  try {
    window.localStorage.setItem(storageKey(tripId, viewDayId), JSON.stringify(orderedIds));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Place timeline row keys at their time-sorted index while preserving other saved positions. */
function insertRowKeysAtTimePosition(
  savedKeys: string[],
  keysToInsert: string[],
  timeSortedKeys: string[]
): string[] {
  const result = savedKeys.filter((key) => keysToInsert.indexOf(key) < 0);
  for (const key of keysToInsert) {
    const timeIndex = timeSortedKeys.indexOf(key);
    if (timeIndex < 0) {
      result.push(key);
      continue;
    }
    const before = new Set(timeSortedKeys.slice(0, timeIndex));
    const after = new Set(timeSortedKeys.slice(timeIndex + 1));
    let insertAt = result.length;
    for (let i = 0; i < result.length; i++) {
      if (after.has(result[i])) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === result.length) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (before.has(result[i])) {
          insertAt = i + 1;
          break;
        }
      }
    }
    result.splice(insertAt, 0, key);
  }
  return result;
}

function readTimelineRowKeys(tripId: string, viewDayId: string): string[] {
  try {
    const s = window.localStorage.getItem(timelineRowStorageKey(tripId, viewDayId));
    if (!s) return [];
    const rawKeys = JSON.parse(s) as string[];
    return Array.isArray(rawKeys) ? rawKeys : [];
  } catch {
    return [];
  }
}

function saveTimelineRowsForEntry(
  tripId: string,
  viewDayId: string,
  entryId: string,
  rows: Array<{ key: string; entry: ItineraryEntry }>
): void {
  const timeSortedKeys = rows.map((r) => r.key);
  const entryRowKeys = rows.filter((r) => r.entry.id === entryId).map((r) => r.key);
  if (entryRowKeys.length === 0) return;
  const savedKeys = readTimelineRowKeys(tripId, viewDayId);
  const nextKeys =
    savedKeys.length > 0
      ? insertRowKeysAtTimePosition(savedKeys, entryRowKeys, timeSortedKeys)
      : timeSortedKeys;
  saveDayViewTimelineRowOrder(tripId, viewDayId, nextKeys);
}
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
  const nextIds =
    Array.isArray(rawIds) && rawIds.length > 0
      ? insertEntryIdAtTimePosition(rawIds, entryId, sorted)
      : sorted.map((e) => e.id);
  saveDayViewEntryOrder(tripId, viewDayId, nextIds);
  const ordered = applyDayViewEntryOrder(tripId, viewDayId, sorted, calendarDate, tripDays);
  const rows = expandTimelineDisplayRows(ordered, calendarDate, tripDays);
  saveTimelineRowsForEntry(tripId, viewDayId, entryId, rows);
}

/** Re-slot an entry by time on every day column where it appears (home day, carryovers, checkout). */
export function syncDayColumnsForEntryTimeOrder(
  entry: ItineraryEntry,
  entries: ItineraryEntry[],
  tripDays: TripDay[],
  options?: { reposition?: boolean }
): void {
  const tripId = (entry.tripId || '').trim();
  if (!tripId) return;
  const preTripDayId = resolvePreTripDayId(tripDays, tripId);
  const reposition = options?.reposition === true;

  for (const day of tripDays) {
    if (day.tripId !== tripId) continue;
    const onDay =
      entry.dayId === day.id ||
      isEntryOnCalendarDate(entry, day.calendarDate, day.dayType, { viewingDayId: day.id, preTripDayId }, tripDays);
    if (!onDay) continue;

    const sorted = sortEntriesForDay(
      entries,
      day.id,
      day.calendarDate,
      day.dayType,
      preTripDayId,
      isPreTripDayRow(day),
      tripDays
    );
    const rawIds = readDayViewEntryOrder(tripId, day.id);
    let nextIds: string[];
    if (rawIds.length === 0) {
      nextIds = sorted.map((e) => e.id);
    } else if (reposition || rawIds.indexOf(entry.id) < 0) {
      nextIds = insertEntryIdAtTimePosition(rawIds, entry.id, sorted);
    } else {
      nextIds = rawIds;
    }
    saveDayViewEntryOrder(tripId, day.id, nextIds);
    if (reposition || rawIds.indexOf(entry.id) < 0) {
      const ordered = applyDayViewEntryOrder(tripId, day.id, sorted, day.calendarDate, tripDays);
      const rows = expandTimelineDisplayRows(ordered, day.calendarDate, tripDays);
      saveTimelineRowsForEntry(tripId, day.id, entry.id, rows);
    }
  }
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

/** Place one entry at its time-sorted index while preserving other saved positions. */
function insertEntryIdAtTimePosition(
  orderedIds: string[],
  entryId: string,
  timeSorted: ItineraryEntry[]
): string[] {
  const timeIndex = timeSorted.findIndex((e) => e.id === entryId);
  const without = orderedIds.filter((id) => id !== entryId);
  if (timeIndex < 0) return [...without, entryId];

  const beforeIds = new Set(timeSorted.slice(0, timeIndex).map((e) => e.id));
  const afterIds = new Set(timeSorted.slice(timeIndex + 1).map((e) => e.id));

  let insertAt = without.length;
  for (let i = 0; i < without.length; i++) {
    if (afterIds.has(without[i])) {
      insertAt = i;
      break;
    }
  }
  if (insertAt === without.length) {
    for (let i = without.length - 1; i >= 0; i--) {
      if (beforeIds.has(without[i])) {
        insertAt = i + 1;
        break;
      }
    }
  }
  const next = [...without];
  next.splice(insertAt, 0, entryId);
  return next;
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
