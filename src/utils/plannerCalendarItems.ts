import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { parseDurationMinutes, durationFromDateTimes } from './durationFromTimes';
import { cruisePortPlannerBlocks, isCruiseSeaOrScenicEntry } from './cruisePlannerUtils';
import { effectivePlannerTimeStart } from './itineraryDayEntries';
import { isLocationInfoEntry } from './locationInfoEntry';
import { isPendingItineraryEntryId } from './itineraryEntryIds';
import { formatTimeHHMM, minutesFromTimeStart, effectiveAccommodationArrivalTime, effectiveAccommodationDepartureTime, effectiveCruiseBoardingTime, effectiveCruiseDisembarkTime, formatAccommodationArriveLabel, formatAccommodationDepartLabel } from './itineraryTimeUtils';
import { filterSubItemsForDay } from './subItemDateUtils';

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
const MINUTES_PER_DAY = 24 * 60;

function skipPendingBlankDraft(entry: ItineraryEntry): boolean {
  return isPendingItineraryEntryId(entry.id) && !entry.title.trim();
}

function ymdSlice(value: string | undefined): string {
  return (value || '').slice(0, 10);
}

function entryHomeCalendarYmd(entry: ItineraryEntry, tripDays: TripDay[]): string {
  const row = tripDays.find((d) => d.id === entry.dayId);
  return ymdSlice(row?.calendarDate || entry.dateStart);
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

/** @deprecated Use cruisePortPlannerBlocks — kept for tests/callers expecting simple blocks. */
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
  const sameDayStay = Boolean(checkInDay && checkOutDay && checkInDay === checkOutDay);
  const base = entry.title?.trim() || 'Accommodation';
  const blocks: Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> = [];
  if (day && checkInDay === day) {
    const start = minutesFromTimeStart(effectiveAccommodationArrivalTime(entry));
    if (start !== undefined) {
      blocks.push({
        keySuffix: 'checkin',
        startMinutes: start,
        durationMinutes: PORT_MARKER_MINUTES,
        title: `${base} · ${formatAccommodationArriveLabel(entry)}`
      });
    }
  }
  if (day && checkOutDay === day) {
    let start = minutesFromTimeStart(effectiveAccommodationDepartureTime(entry));
    if (start === undefined) {
      // Same-day stays must not default checkout to 08:00 — that inverts arrive/depart order.
      const checkinBlock = blocks.find((b) => b.keySuffix === 'checkin');
      start = sameDayStay && checkinBlock ? checkinBlock.startMinutes + PORT_MARKER_MINUTES : 8 * 60;
    }
    const checkinBlock = blocks.find((b) => b.keySuffix === 'checkin');
    if (sameDayStay && checkinBlock && start <= checkinBlock.startMinutes) {
      start = checkinBlock.startMinutes + PORT_MARKER_MINUTES;
    }
    blocks.push({
      keySuffix: 'checkout',
      startMinutes: start,
      durationMinutes: PORT_MARKER_MINUTES,
      title: `${base} · ${formatAccommodationDepartLabel(entry)}`
    });
  }
  return blocks;
}

export function wholeCruisePlannerBlocks(
  entry: ItineraryEntry,
  calendarDate: string
): Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> {
  const day = ymdSlice(calendarDate);
  const embark = ymdSlice(entry.embarksDate);
  const disembark = ymdSlice(entry.disembarksDate);
  const base = entry.title?.trim() || 'Cruise';
  const blocks: Array<{ keySuffix: string; startMinutes: number; durationMinutes: number; title: string }> = [];
  if (day && embark === day) {
    const start = minutesFromTimeStart(effectiveCruiseBoardingTime(entry));
    if (start !== undefined) {
      blocks.push({
        keySuffix: 'boarding',
        startMinutes: start,
        durationMinutes: PORT_MARKER_MINUTES,
        title: `${base} · Boarding`
      });
    }
  }
  if (day && disembark === day) {
    const start = minutesFromTimeStart(effectiveCruiseDisembarkTime(entry));
    blocks.push({
      keySuffix: 'disembark',
      startMinutes: start ?? 8 * 60,
      durationMinutes: PORT_MARKER_MINUTES,
      title: `${base} · Disembark${effectiveCruiseDisembarkTime(entry) ? ` ${formatTimeHHMM(effectiveCruiseDisembarkTime(entry))}` : ''}`
    });
  }
  return blocks;
}

interface FlightPlannerBlock {
  keySuffix: string;
  startMinutes: number;
  durationMinutes: number;
  title: string;
}

function flightPlannerBlocks(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[]
): FlightPlannerBlock[] {
  if (entry.category !== 'Flights') return [];
  const viewYmd = ymdSlice(calendarDate);
  const depYmd = ymdSlice(entry.dateStart || entryHomeCalendarYmd(entry, tripDays));
  const arrYmd = ymdSlice(entry.arrivalDate || depYmd);
  const depM = minutesFromTimeStart(entry.timeStart || '');
  const arrM = minutesFromTimeStart(entry.arrivalTime || '');
  const title = entry.title?.trim() || 'Flight';
  const blocks: FlightPlannerBlock[] = [];

  if (viewYmd === depYmd && depM !== undefined) {
    if (depYmd === arrYmd && arrM !== undefined && arrM > depM) {
      blocks.push({ keySuffix: 'leg', startMinutes: depM, durationMinutes: arrM - depM, title });
    } else if (depYmd !== arrYmd) {
      blocks.push({
        keySuffix: 'depart',
        startMinutes: depM,
        durationMinutes: MINUTES_PER_DAY - depM,
        title
      });
    } else {
      const parsed = parseDurationMinutes(entry.duration || '');
      blocks.push({
        keySuffix: 'leg',
        startMinutes: depM,
        durationMinutes: parsed > 0 ? parsed : 60,
        title
      });
    }
  } else if (viewYmd === arrYmd && depYmd !== arrYmd) {
    if (arrM !== undefined) {
      blocks.push({ keySuffix: 'arrive', startMinutes: 0, durationMinutes: Math.max(arrM, PORT_MARKER_MINUTES), title });
    }
  } else if (viewYmd > depYmd && viewYmd < arrYmd) {
    blocks.push({ keySuffix: 'inflight', startMinutes: 0, durationMinutes: MINUTES_PER_DAY, title: `${title} (in flight)` });
  }
  return blocks;
}

function transportPlannerBlocks(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[]
): FlightPlannerBlock[] {
  if (entry.category !== 'Transport') return [];
  const viewYmd = ymdSlice(calendarDate);
  const homeYmd = entryHomeCalendarYmd(entry, tripDays);
  const depYmd = ymdSlice(entry.dateStart || homeYmd);
  const retYmd = ymdSlice(entry.returnDate || '');
  const blocks: FlightPlannerBlock[] = [];
  const title = entry.title?.trim() || 'Transport';

  if (depYmd && viewYmd === depYmd) {
    const start = minutesFromTimeStart(entry.timeStart || '');
    if (start !== undefined) {
      const end = minutesFromTimeStart(entry.arrivalTime || '');
      const dur =
        end !== undefined && end > start
          ? end - start
          : parseDurationMinutes(entry.duration || '') || 60;
      blocks.push({ keySuffix: 'outbound', startMinutes: start, durationMinutes: dur, title });
    }
  }

  if (entry.journeyType === 'return' && retYmd && viewYmd === retYmd) {
    const start = minutesFromTimeStart(entry.returnTime || '');
    if (start !== undefined) {
      const end = minutesFromTimeStart(entry.returnArrivalTime || '');
      const returnDur = parseDurationMinutes(
        durationFromDateTimes({
          startDate: entry.returnDate,
          startTime: entry.returnTime,
          endDate: entry.returnDate,
          endTime: entry.returnArrivalTime
        }) || ''
      );
      const dur =
        end !== undefined && end > start
          ? end - start
          : returnDur > 0
            ? returnDur
            : 60;
      blocks.push({
        keySuffix: 'return',
        startMinutes: start,
        durationMinutes: dur,
        title: `${title} (return)`
      });
    }
  }
  return blocks;
}

export function parsePlannerDurationMinutes(duration: string | undefined): number {
  const parsed = parseDurationMinutes(duration || '');
  return parsed > 0 ? parsed : 60;
}

export function entryHasTimedSubs(entry: ItineraryEntry, calendarDate?: string): boolean {
  const subs = calendarDate ? filterSubItemsForDay(entry.subItems, calendarDate) : (entry.subItems ?? []);
  return subs.some((s) => minutesFromTimeStart(s.startTime || '') !== undefined);
}

function entryHasParentTimedBlock(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries: ItineraryEntry[]
): boolean {
  if (isWholeCruiseEntry(entry)) return false;
  if (isCruisePortEntry(entry) && cruisePortPlannerBlocks(entry, calendarDate, tripDays, tripEntries).length > 0) {
    return true;
  }
  if (isAccommodationEntry(entry) && accommodationPlannerBlocks(entry, calendarDate).length > 0) return true;
  if (entry.category === 'Flights' && flightPlannerBlocks(entry, calendarDate, tripDays).length > 0) return true;
  if (entry.category === 'Transport' && transportPlannerBlocks(entry, calendarDate, tripDays).length > 0) return true;
  return minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays)) !== undefined;
}

export function isPlannerUnscheduledEntry(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries?: ItineraryEntry[]
): boolean {
  if (isLocationInfoEntry(entry)) return false;
  if (isWholeCruiseEntry(entry)) return true;
  if (isCruiseSeaOrScenicEntry(entry)) return true;
  const all = tripEntries ?? [];
  if (entryHasParentTimedBlock(entry, calendarDate, tripDays, all)) return false;
  if (entryHasTimedSubs(entry, calendarDate)) return false;
  return true;
}

export function shouldRenderPlannerItem(item: PlannerTimedItem, calendarDate: string): boolean {
  if (item.subItem) return true;
  if (item.key.includes('-port-') || item.key.includes('-acc-') || item.key.includes('-cru-') || item.key.includes('-flt-') || item.key.includes('-trn-')) return true;
  if (item.key.includes('-opt')) return true;
  return !entryHasTimedSubs(item.entry, calendarDate);
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

function pushUntimedSubs(
  _items: PlannerTimedItem[],
  _entry: ItineraryEntry,
  _untimedSubs: ItinerarySubItem[],
  _parentTitle: string,
  _timedSubsCount = 0
): void {
  // Untimed options belong in the unscheduled list only — not on the timeline with synthetic times.
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

/** Defer hotel check-in until after same-day flights/transport when wall-clock time is earlier. */
export function adjustPlannerAccommodationOrder(items: PlannerTimedItem[]): void {
  let latestJourneyEnd = -1;
  for (const item of items) {
    if (item.key.includes('-acc-')) continue;
    if (item.category === 'Flights' || item.category === 'Transport') {
      latestJourneyEnd = Math.max(latestJourneyEnd, item.startMinutes + item.durationMinutes);
    }
  }
  if (latestJourneyEnd < 0) return;

  for (const item of items) {
    if (!item.key.endsWith('-acc-checkin')) continue;
    const entry = item.entry;
    const sameDayStay =
      ymdSlice(entry.dateStart) === ymdSlice(entry.dateEnd) && Boolean(entry.dateStart?.trim());
    // Daycation check-in stays at its scheduled time — do not push after evening transport.
    if (sameDayStay) continue;
    const originalStart = item.startMinutes;
    if (originalStart >= latestJourneyEnd) continue;
    const fromLabel = formatTimeHHMM(effectiveAccommodationArrivalTime(item.entry));
    item.startMinutes = Math.min(latestJourneyEnd + 5, MINUTES_PER_DAY - PORT_MARKER_MINUTES);
    if (fromLabel) {
      const base = item.entry.title?.trim() || 'Accommodation';
      item.title = `${base} · ${formatAccommodationArriveLabel(item.entry)}`;
    }
  }

  // Same-day stays: checkout must always follow check-in in the timeline.
  for (const item of items) {
    if (!item.key.endsWith('-acc-checkout')) continue;
    const entry = item.entry;
    if (ymdSlice(entry.dateStart) !== ymdSlice(entry.dateEnd)) continue;
    const checkin = items.find((i) => i.key === `${entry.id}-acc-checkin`);
    if (checkin && item.startMinutes <= checkin.startMinutes) {
      item.startMinutes = Math.min(checkin.startMinutes + PORT_MARKER_MINUTES, MINUTES_PER_DAY - 1);
    }
  }
}

/** Expand day entries into planner blocks — timed options and cruise ports become their own entries. */
export function expandPlannerTimedItems(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries?: ItineraryEntry[]
): PlannerTimedItem[] {
  const allTripEntries = tripEntries ?? entries;
  const items: PlannerTimedItem[] = [];
  for (const entry of entries) {
    if (isLocationInfoEntry(entry)) continue;
    if (skipPendingBlankDraft(entry)) continue;
    const subs = filterSubItemsForDay(entry.subItems, calendarDate).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );
    const timedSubs = subs.filter((s) => minutesFromTimeStart(s.startTime || '') !== undefined);
    const untimedSubs = subs.filter((s) => minutesFromTimeStart(s.startTime || '') === undefined);

    if (isWholeCruiseEntry(entry)) {
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Cruise');
      pushUntimedSubs(items, entry, untimedSubs, entry.title || 'Cruise', timedSubs.length);
      continue;
    }

    if (isCruisePortEntry(entry)) {
      if (!isCruiseSeaOrScenicEntry(entry)) {
        for (const block of cruisePortPlannerBlocks(entry, calendarDate, tripDays, allTripEntries)) {
          items.push({
            key: `${entry.id}-port-${block.keySuffix}`,
            entry,
            title: block.title,
            category: entry.category,
            startMinutes: block.startMinutes,
            durationMinutes: block.durationMinutes
          });
        }
      }
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Untitled');
      pushUntimedSubs(items, entry, untimedSubs, entry.title || 'Untitled', timedSubs.length);
      continue;
    }

    if (entry.category === 'Flights') {
      for (const block of flightPlannerBlocks(entry, calendarDate, tripDays)) {
        items.push({
          key: `${entry.id}-flt-${block.keySuffix}`,
          entry,
          title: block.title,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes
        });
      }
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Untitled');
      pushUntimedSubs(items, entry, untimedSubs, entry.title || 'Untitled', timedSubs.length);
      continue;
    }

    if (entry.category === 'Transport') {
      for (const block of transportPlannerBlocks(entry, calendarDate, tripDays)) {
        items.push({
          key: `${entry.id}-trn-${block.keySuffix}`,
          entry,
          title: block.title,
          category: entry.category,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes
        });
      }
      if (!transportPlannerBlocks(entry, calendarDate, tripDays).length) {
        const entryStart = minutesFromTimeStart(effectivePlannerTimeStart(entry, calendarDate, tripDays));
        if (entryStart !== undefined && !entryHasTimedSubs(entry, calendarDate)) {
          items.push({
            key: entry.id,
            entry,
            title: entry.title || 'Untitled',
            category: entry.category,
            startMinutes: entryStart,
            durationMinutes: timedBlockDurationMinutes(entryStart, entry.arrivalTime, entry.duration)
          });
        }
      }
      pushTimedSubs(items, entry, timedSubs, entry.title || 'Untitled');
      pushUntimedSubs(items, entry, untimedSubs, entry.title || 'Untitled', timedSubs.length);
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
    if (entryStart !== undefined && !entryHasTimedSubs(entry, calendarDate) && !isAccommodationEntry(entry)) {
      const endField = entry.arrivalTime;
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
    pushUntimedSubs(items, entry, untimedSubs, entry.title || 'Untitled', timedSubs.length);
  }

  adjustPlannerAccommodationOrder(items);
  items.sort((a, b) => a.startMinutes - b.startMinutes || a.title.localeCompare(b.title));
  return items;
}

export function expandPlannerUnscheduledItems(
  entries: ItineraryEntry[],
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries?: ItineraryEntry[]
): PlannerUnscheduledItem[] {
  const all = tripEntries ?? entries;
  const items: PlannerUnscheduledItem[] = [];
  for (const entry of entries) {
    if (isLocationInfoEntry(entry)) continue;
    if (skipPendingBlankDraft(entry)) continue;
    const untimedSubs = filterSubItemsForDay(entry.subItems, calendarDate).filter(
      (s) => minutesFromTimeStart(s.startTime || '') === undefined
    );
    const parentOnTimeline = expandPlannerTimedItems([entry], calendarDate, tripDays, all)
      .filter((item) => shouldRenderPlannerItem(item, calendarDate) && !item.subItem)
      .some((item) => item.entry.id === entry.id);

    if (isPlannerUnscheduledEntry(entry, calendarDate, tripDays, all)) {
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
