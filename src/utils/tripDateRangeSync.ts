import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { JournalEntry } from '../models/JournalEntry';
import type { JournalPhoto } from '../models/JournalPhoto';
import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';

export function ymdSlice(d?: string): string {
  return (d || '').trim().slice(0, 10);
}

/** Calendar day immediately before `ymd` (UTC date math). */
export function calendarDayBefore(ymd: string): string {
  const core = ymdSlice(ymd);
  if (!core) return '';
  const d = new Date(`${core}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return core;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Inclusive calendar days between start and end (YYYY-MM-DD). */
export function eachCalendarDayYmd(dateStart: string, dateEnd: string): string[] {
  const start = ymdSlice(dateStart);
  const end = ymdSlice(dateEnd);
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  const current = new Date(`${start}T12:00:00.000Z`);
  const endDate = new Date(`${end}T12:00:00.000Z`);
  while (current <= endDate) {
    out.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return out;
}

/** Sort trip days for sidebar / lists: pre-trip first, then by calendar date. */
export function compareTripDaysChronological(a: TripDay, b: TripDay): number {
  const aPre = isPreTripDayRow(a);
  const bPre = isPreTripDayRow(b);
  if (aPre !== bPre) return aPre ? -1 : 1;
  const ca = ymdSlice(a.calendarDate);
  const cb = ymdSlice(b.calendarDate);
  if (ca !== cb) return ca.localeCompare(cb);
  return a.dayNumber - b.dayNumber;
}

export function shouldAutoUpdateDayTitle(displayTitle: string, dayNumber: number): boolean {
  const t = (displayTitle || '').trim();
  if (!t) return true;
  if (t === `Day ${dayNumber}`) return true;
  return /^Day \d+$/.test(t);
}

export interface TripDayRenumberPatch {
  id: string;
  dayNumber: number;
  displayTitle: string;
}

/** Assign day numbers 1..N by calendar order (pre-trip unchanged). */
export function planChronologicalRenumber(tripDays: TripDay[]): TripDayRenumberPatch[] {
  const patches: TripDayRenumberPatch[] = [];
  const main = tripDays
    .filter((d) => !isPreTripDayRow(d))
    .slice()
    .sort((a, b) => ymdSlice(a.calendarDate).localeCompare(ymdSlice(b.calendarDate)));

  main.forEach((day, idx) => {
    const newNum = idx + 1;
    const autoTitle = shouldAutoUpdateDayTitle(day.displayTitle, day.dayNumber);
    const nextTitle = autoTitle ? `Day ${newNum}` : day.displayTitle;
    if (day.dayNumber !== newNum || (autoTitle && day.displayTitle !== nextTitle)) {
      patches.push({ id: day.id, dayNumber: newNum, displayTitle: nextTitle });
    }
  });
  return patches;
}

export function isCalendarDateInRange(ymd: string, rangeStart: string, rangeEnd: string): boolean {
  const d = ymdSlice(ymd);
  const s = ymdSlice(rangeStart);
  const e = ymdSlice(rangeEnd);
  if (!d || !s || !e) return false;
  return d >= s && d <= e;
}

export interface DayContentSummary {
  itineraryCount: number;
  journalEntryCount: number;
  journalPhotoCount: number;
}

export function countDayContent(
  dayId: string,
  itinerary: ItineraryEntry[],
  journalEntries: JournalEntry[],
  journalPhotos: JournalPhoto[]
): DayContentSummary {
  return {
    itineraryCount: itinerary.filter((e) => e.dayId === dayId && !e.parentEntryId).length,
    journalEntryCount: journalEntries.filter((e) => e.dayId === dayId).length,
    journalPhotoCount: journalPhotos.filter((p) => p.dayId === dayId).length
  };
}

export function dayHasContent(summary: DayContentSummary): boolean {
  return summary.itineraryCount + summary.journalEntryCount + summary.journalPhotoCount > 0;
}

export interface OrphanedTripDay {
  day: TripDay;
  content: DayContentSummary;
}

export interface TripDateRangeChangePlan {
  newStart: string;
  newEnd: string;
  datesToCreate: string[];
  orphanedDays: OrphanedTripDay[];
  /** True when at least one day with content has a calendar date inside the new range. */
  hasOverlapWithContentDays: boolean;
  requiresReassignment: boolean;
}

export function listMissingCalendarDates(dateStart: string, dateEnd: string, tripDays: TripDay[]): string[] {
  const existing = new Set(
    tripDays.filter((d) => !isPreTripDayRow(d)).map((d) => ymdSlice(d.calendarDate)).filter(Boolean)
  );
  return eachCalendarDayYmd(dateStart, dateEnd).filter((ymd) => !existing.has(ymd));
}

export function analyzeTripDateRangeChange(input: {
  newStart: string;
  newEnd: string;
  tripDays: TripDay[];
  itinerary: ItineraryEntry[];
  journalEntries: JournalEntry[];
  journalPhotos: JournalPhoto[];
}): TripDateRangeChangePlan {
  const newStart = ymdSlice(input.newStart);
  const newEnd = ymdSlice(input.newEnd);
  const datesToCreate = listMissingCalendarDates(newStart, newEnd, input.tripDays);

  const orphanedDays: OrphanedTripDay[] = [];
  let hasOverlapWithContentDays = false;

  for (const day of input.tripDays) {
    if (isPreTripDayRow(day)) continue;
    const cal = ymdSlice(day.calendarDate);
    if (!cal) continue;
    const content = countDayContent(day.id, input.itinerary, input.journalEntries, input.journalPhotos);
    if (dayHasContent(content) && isCalendarDateInRange(cal, newStart, newEnd)) {
      hasOverlapWithContentDays = true;
    }
    if (!isCalendarDateInRange(cal, newStart, newEnd) && dayHasContent(content)) {
      orphanedDays.push({ day, content });
    }
  }

  orphanedDays.sort((a, b) => ymdSlice(a.day.calendarDate).localeCompare(ymdSlice(b.day.calendarDate)));

  return {
    newStart,
    newEnd,
    datesToCreate,
    orphanedDays,
    hasOverlapWithContentDays,
    requiresReassignment: orphanedDays.length > 0
  };
}

export function suggestReassignmentTargetDayId(
  orphanedCalendarDate: string,
  targetDays: TripDay[],
  newStart: string,
  newEnd: string
): string | undefined {
  const candidates = targetDays.filter(
    (d) => !isPreTripDayRow(d) && isCalendarDateInRange(ymdSlice(d.calendarDate), newStart, newEnd)
  );
  if (!candidates.length) return undefined;

  const orphanMs = new Date(`${ymdSlice(orphanedCalendarDate)}T12:00:00.000Z`).getTime();
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const d of candidates) {
    const cal = ymdSlice(d.calendarDate);
    const diff = Math.abs(new Date(`${cal}T12:00:00.000Z`).getTime() - orphanMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best.id;
}

/** Placeholder id for a day that will be created on save (`__new__YYYY-MM-DD`). */
export function pendingDayToken(ymd: string): string {
  return `__new__${ymdSlice(ymd)}`;
}

export function isPendingDayToken(id: string): boolean {
  return id.startsWith('__new__');
}

export function ymdFromPendingDayToken(id: string): string {
  return id.slice('__new__'.length);
}

export interface TargetDayOption {
  id: string;
  calendarDate: string;
  label: string;
}

export function buildTargetDayOptions(
  tripDays: TripDay[],
  datesToCreate: string[],
  newStart: string,
  newEnd: string
): TargetDayOption[] {
  const options: TargetDayOption[] = [];
  for (const day of tripDays) {
    if (isPreTripDayRow(day)) continue;
    const cal = ymdSlice(day.calendarDate);
    if (!isCalendarDateInRange(cal, newStart, newEnd)) continue;
    const label =
      day.displayTitle?.trim() ||
      (day.dayNumber > 0 ? `Day ${day.dayNumber}` : cal);
    options.push({ id: day.id, calendarDate: cal, label: `${label} · ${cal}` });
  }
  for (const ymd of datesToCreate) {
    options.push({
      id: pendingDayToken(ymd),
      calendarDate: ymd,
      label: `New day · ${ymd}`
    });
  }
  options.sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
  return options;
}

export function resolveReassignmentTargets(
  mappings: Record<string, string>,
  createdByDate: Map<string, TripDay>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const fromDayId of Object.keys(mappings)) {
    const targetId = mappings[fromDayId];
    if (!targetId || fromDayId === targetId) continue;
    if (isPendingDayToken(targetId)) {
      const ymd = ymdFromPendingDayToken(targetId);
      const created = createdByDate.get(ymd);
      if (created) resolved[fromDayId] = created.id;
    } else {
      resolved[fromDayId] = targetId;
    }
  }
  return resolved;
}
