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

function ymdSlice(value: string): string {
  return value.slice(0, 10);
}

type CruiseDayKind = 'embark' | 'disembark' | 'at-sea';

function cruiseDayKind(entry: ItineraryEntry, calendarDate: string): CruiseDayKind | null {
  if (entry.category !== 'Cruise' || !entry.embarksDate || !entry.disembarksDate) return null;
  const day = ymdSlice(calendarDate);
  const emb = ymdSlice(entry.embarksDate);
  const dis = ymdSlice(entry.disembarksDate);
  if (day < emb || day > dis) return null;
  if (day === emb) return 'embark';
  if (day === dis) return 'disembark';
  return 'at-sea';
}

function cruisePlannerBlock(
  entry: ItineraryEntry,
  calendarDate: string,
  kind: CruiseDayKind
): { title: string; startMinutes: number; durationMinutes: number } {
  const base = entry.title?.trim() || 'Cruise';
  if (kind === 'embark') {
    const start = minutesFromTimeStart(entry.timeStart || '') ?? 8 * 60;
    return { title: `${base} · Embark`, startMinutes: start, durationMinutes: 120 };
  }
  if (kind === 'disembark') {
    const start = minutesFromTimeStart(entry.arrivalTime || entry.timeStart || '') ?? 8 * 60;
    return { title: `${base} · Disembark`, startMinutes: start, durationMinutes: 120 };
  }
  return { title: `${base} · At sea`, startMinutes: 8 * 60, durationMinutes: 8 * 60 };
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
  const parsed = parsePlannerDurationMinutes(sub.duration);
  if (parsed > 0 && parsed !== 60) return parsed;
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
      const cruiseKind = cruiseDayKind(entry, calendarDate);
      const title =
        cruiseKind === 'embark'
          ? `${entry.title || 'Cruise'} · Embark`
          : cruiseKind === 'disembark'
            ? `${entry.title || 'Cruise'} · Disembark`
            : entry.title || 'Untitled';
      items.push({
        key: entry.id,
        entry,
        title,
        category: entry.category,
        startMinutes: entryStart,
        durationMinutes: parsePlannerDurationMinutes(entry.duration),
        inlineSubs: untimedSubs.length ? untimedSubs : undefined
      });
    } else {
      const cruiseKind = cruiseDayKind(entry, calendarDate);
      if (cruiseKind) {
        const block = cruisePlannerBlock(entry, calendarDate, cruiseKind);
        items.push({
          key: `${entry.id}-cruise-${calendarDate}`,
          entry,
          title: block.title,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes,
          inlineSubs: untimedSubs.length ? untimedSubs : undefined
        });
      }
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
