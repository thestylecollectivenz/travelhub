import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { formatLocationText } from './placeDisplayLabel';
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
  return supplier || entry.shipName?.trim() || undefined;
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

function portPlaceKey(entry: ItineraryEntry): string {
  return normalizePlace(formatLocationText((entry.location || entry.title || '').trim()));
}

function cruisesDisembarkingOn(ymd: string, tripEntries: ItineraryEntry[]): ItineraryEntry[] {
  return tripEntries.filter(
    (e) => e.category === 'Cruise' && !!e.disembarksDate?.trim() && ymdSlice(e.disembarksDate) === ymd
  );
}

function cruisesEmbarkingOn(ymd: string, tripEntries: ItineraryEntry[]): ItineraryEntry[] {
  return tripEntries.filter(
    (e) => e.category === 'Cruise' && !!e.embarksDate?.trim() && ymdSlice(e.embarksDate) === ymd
  );
}

function adjacentCalendarYmd(ymd: string, tripDays: TripDay[], offset: -1 | 1): string | undefined {
  const ordered = tripDays
    .map((d) => ymdSlice(d.calendarDate))
    .filter(Boolean)
    .sort();
  const idx = ordered.indexOf(ymd);
  if (idx < 0) return undefined;
  const next = ordered[idx + offset];
  return next || undefined;
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
  tripEntries: ItineraryEntry[]
): CruisePortPlannerBlock[] {
  if (entry.category !== 'Cruise port' || isCruiseSeaOrScenicEntry(entry)) return [];

  const viewYmd = ymdSlice(calendarDate);
  const entryYmd = calendarDateForEntry(entry, tripDays);
  if (!viewYmd || viewYmd !== entryYmd) return [];

  const arrive = minutesFromTimeStart(entry.timeStart || '');
  const depart = minutesFromTimeStart(entry.arrivalTime || '');
  const place = formatLocationText((entry.location || entry.title || 'port').trim());
  const markerMinutes = 60;

  const disembarkCruises = cruisesDisembarkingOn(entryYmd, tripEntries);
  const embarkCruises = cruisesEmbarkingOn(entryYmd, tripEntries);

  const blocks: CruisePortPlannerBlock[] = [];

  for (const cruise of disembarkCruises) {
    if (arrive === undefined) continue;
    const ship = cruiseShipLabel(cruise);
    const title = ship ? `${ship} · Disembark ${place}` : `Disembark ${place}`;
    blocks.push({
      keySuffix: `disembark-${cruise.id}`,
      startMinutes: arrive,
      durationMinutes: markerMinutes,
      title
    });
  }

  for (const cruise of embarkCruises) {
    if (depart === undefined) continue;
    const ship = cruiseShipLabel(cruise);
    const title = ship ? `${ship} departs from ${place}` : `Departs from ${place}`;
    blocks.push({
      keySuffix: `embark-${cruise.id}`,
      startMinutes: depart,
      durationMinutes: markerMinutes,
      title
    });
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const prevYmd = adjacentCalendarYmd(viewYmd, tripDays, -1);
  const nextYmd = adjacentCalendarYmd(viewYmd, tripDays, 1);
  const prevPort = prevYmd ? cruisePortOnCalendarDate(tripEntries, tripDays, prevYmd) : undefined;
  const nextPort = nextYmd ? cruisePortOnCalendarDate(tripEntries, tripDays, nextYmd) : undefined;
  const samePortAsPrev = prevPort && portPlaceKey(prevPort) === portPlaceKey(entry);
  const samePortAsNext = nextPort && portPlaceKey(nextPort) === portPlaceKey(entry);

  const ship = cruiseShipLabel(entry);
  const departLabel = ship ? `${ship} departs ${place}` : `Departs ${place}`;

  if (samePortAsPrev && samePortAsNext) {
    return blocks;
  }

  if (!samePortAsPrev && samePortAsNext) {
    if (arrive !== undefined) {
      blocks.push({
        keySuffix: 'arrive',
        startMinutes: arrive,
        durationMinutes: markerMinutes,
        title: `Arrives in ${place}`
      });
    }
    return blocks;
  }

  if (samePortAsPrev && !samePortAsNext) {
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
