import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
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

export function isWholeCruiseEntry(entry: ItineraryEntry): boolean {
  return entry.category === 'Cruise' && !!entry.embarksDate?.trim() && !!entry.disembarksDate?.trim();
}

export function isCruisePortEntry(entry: ItineraryEntry): boolean {
  const cat = entry.category?.trim();
  return cat === 'Cruise port' || cat === 'Cruise at sea';
}

export function cruisePortTimedBlocks(
  entry: ItineraryEntry
): Array<{ startMinutes: number; durationMinutes: number; titleSuffix?: string }> {
  const arrive = minutesFromTimeStart(entry.timeStart || '');
  const depart = minutesFromTimeStart(entry.arrivalTime || '');
  if (arrive !== undefined && depart !== undefined && depart > arrive) {
    return [{ startMinutes: arrive, durationMinutes: depart - arrive }];
  }
  if (arrive !== undefined) {
    return [
      {
        startMinutes: arrive,
        durationMinutes: parsePlannerDurationMinutes(entry.duration),
        titleSuffix: '· Arrives'
      }
    ];
  }
  if (depart !== undefined) {
    return [{ startMinutes: depart, durationMinutes: 60, titleSuffix: '· Departs' }];
  }
  return [];
}

export function parsePlannerDurationMinutes(duration: string | undefined): number {
  const raw = (duration || '').trim().toLowerCase();
  if (!raw) return 60;
  const hm = raw.match(/^(\d+)\s*h(?:\s*(\d+)\s*m)?$/);
  if (hm) return (Number(hm[1]) || 0) * 60 + (Number(hm[2]) || 0);
  const mOnly = raw.match(/^(\d+)\s*m$/);
  if (mOnly) return Number(mOnly[1]) || 60;
  const hOnly = raw.match(/^(\d+(?:\.\d+)?)\s*h$/);
  if (hOnly) return Math.round(Number(hOnly[1]) * 60);
  return 60;
}

export function entryHasTimedSubs(entry: ItineraryEntry): boolean {
  return (entry.subItems ?? []).some((s) => minutesFromTimeStart(s.startTime || '') !== undefined);
}

function entryHasParentTimedBlock(entry: ItineraryEntry, calendarDate: string, tripDays: TripDay[]): boolean {
  if (isWholeCruiseEntry(entry)) return false;
  if (isCruisePortEntry(entry) && cruisePortTimedBlocks(entry).length > 0) return true;
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
  return !entryHasTimedSubs(item.entry);
}

function subItemDurationMinutes(sub: ItinerarySubItem): number {
  const start = minutesFromTimeStart(sub.startTime || '');
  const end = minutesFromTimeStart(sub.endTime || '');
  if (start !== undefined && end !== undefined && end > start) return end - start;
  const parsed = parsePlannerDurationMinutes(sub.duration);
  if (parsed > 0 && parsed !== 60) return parsed;
  return 60;
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
      for (const sub of timedSubs) {
        const sm = minutesFromTimeStart(sub.startTime || '')!;
        items.push({
          key: `${entry.id}-${sub.id}`,
          entry,
          subItem: sub,
          parentTitle: entry.title || 'Cruise',
          title: sub.title || 'Untitled',
          category: (sub.category || entry.category || 'Other').trim(),
          startMinutes: sm,
          durationMinutes: subItemDurationMinutes(sub)
        });
      }
      continue;
    }

    if (isCruisePortEntry(entry)) {
      const base = entry.title?.trim() || (entry.category === 'Cruise at sea' ? 'At sea' : 'Cruise port');
      cruisePortTimedBlocks(entry).forEach((block, index) => {
        items.push({
          key: `${entry.id}-port-${index}`,
          entry,
          title: block.titleSuffix ? `${base} ${block.titleSuffix}` : base,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes
        });
      });
      for (const sub of timedSubs) {
        const sm = minutesFromTimeStart(sub.startTime || '')!;
        items.push({
          key: `${entry.id}-${sub.id}`,
          entry,
          subItem: sub,
          parentTitle: entry.title || 'Untitled',
          title: sub.title || 'Untitled',
          category: (sub.category || entry.category || 'Other').trim(),
          startMinutes: sm,
          durationMinutes: subItemDurationMinutes(sub)
        });
      }
      continue;
    }

    const entryStart = minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays));
    if (entryStart !== undefined && !entryHasTimedSubs(entry)) {
      items.push({
        key: entry.id,
        entry,
        title: entry.title || 'Untitled',
        category: entry.category,
        startMinutes: entryStart,
        durationMinutes: parsePlannerDurationMinutes(entry.duration)
      });
    }

    for (const sub of timedSubs) {
      const sm = minutesFromTimeStart(sub.startTime || '')!;
      items.push({
        key: `${entry.id}-${sub.id}`,
        entry,
        subItem: sub,
        parentTitle: entry.title || 'Untitled',
        title: sub.title || 'Untitled',
        category: (sub.category || entry.category || 'Other').trim(),
        startMinutes: sm,
        durationMinutes: subItemDurationMinutes(sub)
      });
    }
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
