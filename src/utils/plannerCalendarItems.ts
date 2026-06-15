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
  /** Untimed options still nested inside a timed parent card. */
  inlineSubs?: ItinerarySubItem[];
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

function subItemDurationMinutes(sub: ItinerarySubItem): number {
  const start = minutesFromTimeStart(sub.startTime || '');
  const end = minutesFromTimeStart(sub.endTime || '');
  if (start !== undefined && end !== undefined && end > start) return end - start;
  return 60;
}

/** Expand day entries into planner blocks — timed options become their own entries. */
export function expandPlannerTimedItems(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays: TripDay[]
): PlannerTimedItem[] {
  const items: PlannerTimedItem[] = [];
  for (const entry of entries) {
    const entryStart = minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays));
    const subs = [...(entry.subItems ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const timedSubs = subs.filter((s) => minutesFromTimeStart(s.startTime || '') !== undefined);
    const untimedSubs = subs.filter((s) => minutesFromTimeStart(s.startTime || '') === undefined);

    if (entryStart !== undefined) {
      items.push({
        key: entry.id,
        entry,
        title: entry.title || 'Untitled',
        category: entry.category,
        startMinutes: entryStart,
        durationMinutes: parsePlannerDurationMinutes(entry.duration),
        inlineSubs: untimedSubs.length ? untimedSubs : undefined
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
