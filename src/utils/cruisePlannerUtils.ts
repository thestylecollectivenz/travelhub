import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { formatLocationText } from './placeDisplayLabel';
import { formatTimeHHMM, minutesFromTimeStart, effectiveCruiseBoardingTime, effectiveCruiseDisembarkTime } from './itineraryTimeUtils';

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

/** Port stop card for a calendar day (Explore / Location Info should use this, not the ship). */
export function cruisePortEntryForDay(
  entries: ItineraryEntry[],
  tripDays: TripDay[],
  calendarDate: string
): ItineraryEntry | undefined {
  return cruisePortOnCalendarDate(entries, tripDays, ymdSlice(calendarDate));
}

export interface CruisePortPlannerBlock {
  keySuffix: string;
  startMinutes: number;
  durationMinutes: number;
  title: string;
}

export function formatCruisePortScheduleHero(
  entry: ItineraryEntry,
  calendarDate: string,
  tripDays: TripDay[],
  tripEntries: ItineraryEntry[]
): string | null {
  if (entry.category !== 'Cruise port' || isCruiseSeaOrScenicEntry(entry)) return null;

  const viewYmd = ymdSlice(calendarDate);
  const entryYmd = calendarDateForEntry(entry, tripDays);
  if (!viewYmd || viewYmd !== entryYmd) return null;

  const arrive = formatTimeHHMM(entry.timeStart || '');
  const depart = formatTimeHHMM(entry.arrivalTime || '');
  const place = formatLocationText((entry.location || entry.title || 'port').trim());

  const disembarkCruises = cruisesDisembarkingOn(entryYmd, tripEntries);
  const embarkCruises = cruisesEmbarkingOn(entryYmd, tripEntries);
  if (disembarkCruises.length || embarkCruises.length) {
    const parts: string[] = [];
    for (const cruise of disembarkCruises) {
      const disembark = formatTimeHHMM(effectiveCruiseDisembarkTime(cruise));
      if (disembark && arrive) {
        parts.push(arrive !== disembark ? `Disembark ${disembark} (Arrives ${arrive})` : `Disembark ${disembark}`);
      } else if (disembark) {
        parts.push(`Disembark ${disembark}`);
      } else if (arrive) {
        parts.push(`Arrives ${arrive}`);
      }
    }
    for (const cruise of embarkCruises) {
      const board = formatTimeHHMM(effectiveCruiseBoardingTime(cruise));
      if (board && depart) {
        parts.push(`Board at ${board} (Departs ${depart})`);
      } else if (depart) {
        parts.push(`Departs ${depart}`);
      } else if (board) {
        parts.push(`Board at ${board}`);
      }
    }
    return parts.length ? parts.join(' · ') : null;
  }

  const prevYmd = adjacentCalendarYmd(viewYmd, tripDays, -1);
  const nextYmd = adjacentCalendarYmd(viewYmd, tripDays, 1);
  const prevPort = prevYmd ? cruisePortOnCalendarDate(tripEntries, tripDays, prevYmd) : undefined;
  const nextPort = nextYmd ? cruisePortOnCalendarDate(tripEntries, tripDays, nextYmd) : undefined;
  const samePortAsPrev = prevPort && portPlaceKey(prevPort) === portPlaceKey(entry);
  const samePortAsNext = nextPort && portPlaceKey(nextPort) === portPlaceKey(entry);

  if (samePortAsPrev && samePortAsNext) {
    return 'Overnight';
  }
  if (!samePortAsPrev && samePortAsNext) {
    if (arrive) return `Arrives ${arrive} · Overnight`;
    return 'Overnight';
  }
  if (samePortAsPrev && !samePortAsNext) {
    if (depart) return `Departs ${depart}`;
    return place ? `Departs · ${place}` : null;
  }

  const parts: string[] = [];
  if (arrive) parts.push(`Arrives ${arrive}`);
  if (depart) parts.push(`Departs ${depart}`);
  return parts.length ? parts.join(' · ') : null;
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
    const disembarkM = minutesFromTimeStart(effectiveCruiseDisembarkTime(cruise));
    const start = disembarkM ?? arrive;
    if (start === undefined) continue;
    const ship = cruiseShipLabel(cruise);
    const disembark = formatTimeHHMM(effectiveCruiseDisembarkTime(cruise));
    const arriveLabel = formatTimeHHMM(entry.timeStart || '');
    const schedule =
      disembark && arriveLabel && disembark !== arriveLabel
        ? `Disembark ${disembark} (Arrives ${arriveLabel})`
        : disembark
          ? `Disembark ${disembark}`
          : `Disembark ${place}`;
    const title = ship ? `${ship} · ${schedule}` : schedule;
    blocks.push({
      keySuffix: `disembark-${cruise.id}`,
      startMinutes: start,
      durationMinutes: markerMinutes,
      title
    });
  }

  for (const cruise of embarkCruises) {
    const boardM = minutesFromTimeStart(effectiveCruiseBoardingTime(cruise));
    const start = boardM ?? depart;
    if (start === undefined) continue;
    const ship = cruiseShipLabel(cruise);
    const board = formatTimeHHMM(effectiveCruiseBoardingTime(cruise));
    const departLabel = formatTimeHHMM(entry.arrivalTime || '');
    const schedule =
      board && departLabel ? `Board at ${board} (Departs ${departLabel})` : departLabel ? `Departs ${departLabel}` : `Board at ${board}`;
    const title = ship ? `${ship} · ${schedule}` : schedule;
    blocks.push({
      keySuffix: `embark-${cruise.id}`,
      startMinutes: start,
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
        keySuffix: 'overnight',
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
