import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { parseDurationMinutes } from './durationFromTimes';
import { effectivePlannerTimeStart } from './itineraryDayEntries';
import { minutesFromTimeStart } from './itineraryTimeUtils';

export interface PlannerTimedItem {
  key: string;
  entry: ItineraryEntry;
  subItem?: ItinerarySubItem;
  parentTitle?: string;
  title: string;
  category: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface PlannerUnscheduledItem {
  key: string;
  entry: ItineraryEntry;
  subItem?: ItinerarySubItem;
  title: string;
}

const PORT_MARKER_MINUTES = 60;

function ymdSlice(value: string | undefined): string {
  return (value || '').slice(0, 10);
}

export function isWholeCruiseEntry(entry: ItineraryEntry): boolean {
  return entry.category === 'Cruise' && !!entry.embarksDate?.trim() && !!entry.disembarksDate?.trim();
}

export function isCruisePortEntry(entry: ItineraryEntry): boolean {
  const cat = entry.category?.trim();
  return cat === 'Cruise port' || cat === 'Cruise at sea';
}

export function isAccommodationEntry(entry: ItineraryEntry): boolean {
  return entry.category === 'Accommodation';
}

/** Short markers at arrive/depart — avoids one tall block over in-port activities. */
export function cruisePortTimedBlocks(
  entry: ItineraryEntry
): Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> {
  const arrive = minutesFromTimeStart(entry.timeStart || '');
  const depart = minutesFromTimeStart(entry.arrivalTime || '');
  const place = (entry.location || entry.title || 'port').trim();
  const blocks: Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> = [];
  if (arrive !== undefined) {
    blocks.push({
      keySuffix: 'arrive',
      startMinutes: arrive,
      durationMinutes: PORT_MARKER_MINUTES,
      title: `Arrives in ${place}`
    });
  }
  if (depart !== undefined) {
    blocks.push({
      keySuffix: 'depart',
      startMinutes: depart,
      durationMinutes: PORT_MARKER_MINUTES,
      title: `Departs ${place}`
    });
  }
  return blocks;
}

export function accommodationPlannerBlocks(
  entry: ItineraryEntry,
  calendarDate: string
): Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> {
  const day = ymdSlice(calendarDate);
  const checkInDay = ymdSlice(entry.dateStart);
  const checkOutDay = ymdSlice(entry.dateEnd);
  const base = entry.title?.trim() || 'Accommodation';
  const blocks: Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> = [];
  if (day && checkInDay === day) {
    const start = minutesFromTimeStart(entry.checkInTime || '');
    if (start !== undefined) {
      blocks.push({
        keySuffix: 'checkin',
        startMinutes: start,
        durationMinutes: PORT_MARKER_MINUTES,
        title: `${base} · Check-in`
      });
    }
  }
  if (day && checkOutDay === day) {
    const start = minutesFromTimeStart(entry.checkOutTime || '');
    if (start !== undefined) {
      blocks.push({
        keySuffix: 'checkout',
        startMinutes: start,
        durationMinutes: PORT_MARKER_MINUTES,
        title: `${base} · Check-out`
      });
    }
  }
  return blocks;
}

export function parsePlannerDurationMinutes(duration: string | undefined): number {
  const parsed = parseDurationMinutes(duration || '');
  return parsed > 0 ? parsed : 60;
}

export function entryHasTimedSubs(entry: ItineraryEntry): boolean {
  return (entry.subItems ?? []).some((s) => minutesFromTimeStart(s.startTime || '') !== undefined);
}

function entryHasParentTimedBlock(entry: ItineraryEntry, calendarDate: string, tripDays: TripDay[]): boolean {
  if (isWholeCruiseEntry(entry)) return false;
  if (isCruisePortEntry(entry) && cruisePortTimedBlocks(entry).length > 0) return true;
  if (isAccommodationEntry(entry) && accommodationPlannerBlocks(entry, calendarDate).length > 0) return true;
  return minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays)) !== undefined;
}

export function isPlannerUnscheduledEntry(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[]
): boolean {
  if (isWholeCruiseEntry(entry)) return true;
  if (entryHasParentTimedBlock(entry, calendarDate, tripDays)) return false;
  if (entryHasTimedSubs(entry)) return false;
  return true;
}

export function shouldRenderPlannerItem(item: PlannerTimedItem): boolean {
  if (item.subItem) return true;
  if (item.key.includes('-port-') || item.key.includes('-acc-')) return true;
  return !entryHasTimedSubs(item.entry);
}

function timedBlockDurationMinutes(
  startMinutes: number,
  endTime: string | undefined,
  duration: string | undefined
): number {
  const end = minutesFromTimeStart(endTime || '');
  if (end !== undefined && end > startMinutes) return end - startMinutes;
  const parsed = parseDurationMinutes(duration || '');
  return parsed > 0 ? parsed : 60;
}

function subItemDurationMinutes(sub: ItinerarySubItem): number {
  const start = minutesFromTimeStart(sub.startTime || '');
  const end = minutesFromTimeStart(sub.endTime || '');
  if (start !== undefined && end !== undefined && end > start) return end - start;
  const parsed = parseDurationMinutes(sub.duration || '');
  return parsed > 0 ? parsed : 60;
}

function pushTimedSubs(
  items: PlannerTimedItem[],
  entry: ItineraryEntry,
  timedSubs: ItinerarySubItem[],
  parentTitle: string
): void {
  for (const sub of timedSubs) {
    const sm = minutesFromTimeStart(sub.startTime || '')!;
    items.push({
      key: `${entry.id}-${sub.id}`,
      entry,
      subItem: sub,
      parentTitle,
      title: sub.title || 'Untitled',
      category: (sub.category || entry.category || 'Other').trim(),
      startMinutes: sm,
      durationMinutes: subItemDurationMinutes(sub)
    });
  }
}

/** Expand day entries into planner blocks — timed options and cruise ports become their own entries. */
export function expandPlannerTimedItems(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays: TripDay[]
): PlannerTimedItem[] {
  const items: PlannerTimedItem[] = [];
  for (const entry of entries) {
    const subs = [...(entry.subItems ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const timedSubs = subs.filter((s) => minutesFromTimeStart(s.startTime || '') !== undefined);

    if (isWholeCruiseEntry(entry)) {
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Cruise');
      continue;
    }

    if (isCruisePortEntry(entry)) {
      for (const block of cruisePortTimedBlocks(entry)) {
        items.push({
          key: `${entry.id}-port-${block.keySuffix}`,
          entry,
          title: block.title,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes
        });
      }
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Untitled');
      continue;
    }

    if (isAccommodationEntry(entry)) {
      for (const block of accommodationPlannerBlocks(entry, calendarDate)) {
        items.push({
          key: `${entry.id}-acc-${block.keySuffix}`,
          entry,
          title: block.title,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes
        });
      }
    }

    const entryStart = minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays));
    if (entryStart !== undefined && !entryHasTimedSubs(entry)) {
      const endField =
        entry.category === 'Flights' || entry.category === 'Transport'
          ? entry.arrivalTime
          : entry.category === 'Accommodation'
            ? undefined
            : entry.arrivalTime;
      items.push({
        key: entry.id,
        entry,
        title: entry.title || 'Untitled',
        category: entry.category,
        startMinutes: entryStart,
        durationMinutes: timedBlockDurationMinutes(entryStart, endField, entry.duration)
      });
    }

    pushTimedSubs(items, entry, timedSubs, entry.title || 'Untitled');
  }
  return items;
}

export function expandPlannerUnscheduledItems(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays: TripDay[]
): PlannerUnscheduledItem[] {
  const items: PlannerUnscheduledItem[] = [];
  for (const entry of entries) {
    const untimedSubs = (entry.subItems ?? []).filter(
      (s) => minutesFromTimeStart(s.startTime || '') === undefined
    );
    const parentOnTimeline = expandPlannerTimedItems([entry], calendarDate, tripDays)
      .filter((item) => shouldRenderPlannerItem(item) && !item.subItem)
      .some((item) => item.entry.id === entry.id);

    if (isPlannerUnscheduledEntry(entry, calendarDate, tripDays)) {
      items.push({
        key: entry.id,
        entry,
        title: entry.title || 'Untitled'
      });
    }

    if (parentOnTimeline || isWholeCruiseEntry(entry)) {
      for (const sub of untimedSubs) {
        items.push({
          key: `${entry.id}-${sub.id}-opt`,
          entry,
          subItem: sub,
          title: sub.title || 'Untitled option'
        });
      }
    }
  }
  return items;
}
