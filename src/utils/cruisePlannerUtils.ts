import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { minutesFromTimeStart } from './itineraryTimeUtils';

export function isCruiseSeaOrScenicEntry(entry: ItineraryEntry): boolean {
  if (entry.category === 'Cruise at sea') return true;
  const text = `${entry.title || ''} ${entry.location || ''} ${entry.notes || ''}`.toLowerCase();
  if (text.includes('days at sea') || text.includes('day at sea') || /\bat sea\b/.test(text)) return true;
  if (text.includes('scenic')) return true;
  if (/\bcruising\b/.test(text) && /\b(channel|fjord|passage|strait|sound|gulf)\b/.test(text)) return true;
  if (text.includes('crossing the arctic') || text.includes('cruising only')) return true;
  if (text.includes('drake passage') || text.includes('glacier alley')) return true;
  if (text.includes('beagle channel') || text.includes('strait of magellan')) return true;
  if (text.includes('chilean fjords') || text.includes('daylight cruising')) return true;
  return false;
}

export function cruiseShipLabel(entry: ItineraryEntry): string | undefined {
  const sub = (entry.subItems ?? []).find((s) => /ship\s*\/\s*operator/i.test(s.title || ''));
  if (sub?.title) {
    const m = sub.title.replace(/^ship\s*\/\s*operator:\s*/i, '').trim();
    if (m) return m;
  }
  const supplier = entry.supplier?.trim();
  return supplier || undefined;
}

function ymdSlice(value: string | undefined): string {
  return (value || '').slice(0, 10);
}

function normalizePlace(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function calendarDateForEntry(entry: ItineraryEntry, tripDays: TripDay[]): string {
  const row = tripDays.find((d) => d.id === entry.dayId);
  return ymdSlice(row?.calendarDate);
}

export function cruisePortEntriesChronological(entries: ItineraryEntry[], tripDays: TripDay[]): ItineraryEntry[] {
  return entries
    .filter((e) => e.category === 'Cruise port' && !e.parentEntryId && !isCruiseSeaOrScenicEntry(e))
    .sort((a, b) => {
      const ad = calendarDateForEntry(a, tripDays);
      const bd = calendarDateForEntry(b, tripDays);
      if (ad && bd && ad !== bd) return ad.localeCompare(bd);
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

function previousCalendarYmd(ymd: string, tripDays: TripDay[]): string | undefined {
  const ordered = tripDays
    .map((d) => ymdSlice(d.calendarDate))
    .filter(Boolean)
    .sort();
  const idx = ordered.indexOf(ymd);
  return idx > 0 ? ordered[idx - 1] : undefined;
}

function cruisePortOnCalendarDate(
  entries: ItineraryEntry[],
  tripDays: TripDay[],
  ymd: string
): ItineraryEntry | undefined {
  return entries.find(
    (e) =>
      e.category === 'Cruise port' &&
      !e.parentEntryId &&
      !isCruiseSeaOrScenicEntry(e) &&
      calendarDateForEntry(e, tripDays) === ymd
  );
}

export interface CruisePortPlannerBlock {
  keySuffix: string;
  startMinutes: number;
  durationMinutes: number;
  title: string;
}

export function cruisePortPlannerBlocks(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[],
  tripPortEntries: ItineraryEntry[]
): CruisePortPlannerBlock[] {
  if (entry.category !== 'Cruise port' || isCruiseSeaOrScenicEntry(entry)) return [];

  const viewYmd = ymdSlice(calendarDate);
  const entryYmd = calendarDateForEntry(entry, tripDays);
  if (!viewYmd || viewYmd !== entryYmd) return [];

  const arrive = minutesFromTimeStart(entry.timeStart || '');
  const depart = minutesFromTimeStart(entry.arrivalTime || '');
  const place = (entry.location || entry.title || 'port').trim();
  const ship = cruiseShipLabel(entry);
  const markerMinutes = 60;

  const chron = cruisePortEntriesChronological(tripPortEntries, tripDays);
  const firstPort = chron[0];
  const lastPort = chron[chron.length - 1];
  const isEmbark = firstPort?.id === entry.id;
  const isDebark = lastPort?.id === entry.id && chron.length > 1;

  const prevYmd = previousCalendarYmd(viewYmd, tripDays);
  const prevPort = prevYmd ? cruisePortOnCalendarDate(tripPortEntries, tripDays, prevYmd) : undefined;
  const samePortAsPrev =
    prevPort && normalizePlace(prevPort.location || prevPort.title) === normalizePlace(place);

  const departLabel = ship ? `${ship} departs ${place}` : `Departs ${place}`;
  const embarkLabel = ship ? `${ship} departs from ${place}` : `Departs from ${place}`;
  const debarkLabel = ship ? `${ship} debarks at ${place}` : `Debarks at ${place}`;

  const blocks: CruisePortPlannerBlock[] = [];

  if (isDebark && !isEmbark) {
    if (arrive !== undefined) {
      blocks.push({
        keySuffix: 'debark',
        startMinutes: arrive,
        durationMinutes: markerMinutes,
        title: debarkLabel
      });
    }
    return blocks;
  }

  if (isEmbark) {
    if (depart !== undefined) {
      blocks.push({
        keySuffix: 'depart',
        startMinutes: depart,
        durationMinutes: markerMinutes,
        title: embarkLabel
      });
    }
    return blocks;
  }

  if (samePortAsPrev) {
    const prevDepart = formatTimeForCompare(prevPort?.arrivalTime);
    const curDepart = formatTimeForCompare(entry.arrivalTime);
    if (depart !== undefined && prevDepart !== curDepart) {
      blocks.push({
        keySuffix: 'depart',
        startMinutes: depart,
        durationMinutes: markerMinutes,
        title: departLabel
      });
    }
    return blocks;
  }

  if (arrive !== undefined) {
    blocks.push({
      keySuffix: 'arrive',
      startMinutes: arrive,
      durationMinutes: markerMinutes,
      title: `Arrives in ${place}`
    });
  }
  if (depart !== undefined) {
    blocks.push({
      keySuffix: 'depart',
      startMinutes: depart,
      durationMinutes: markerMinutes,
      title: departLabel
    });
  }
  return blocks;
}

function formatTimeForCompare(value: string | undefined): string {
  const m = minutesFromTimeStart(value || '');
  return m === undefined ? '' : String(m);
}
