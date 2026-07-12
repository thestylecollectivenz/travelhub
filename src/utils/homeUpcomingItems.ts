import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { TripDay } from '../models/TripDay';
import { isPreTripDayRow } from './itineraryDayEntries';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { todayYmdLocal } from './tripListSort';

export interface HomeUpcomingItem {
  id: string;
  title: string;
  sub?: string;
  dayLabel: string;
  ymd: string;
  daysUntil: number;
}

function daysUntil(ymd: string, today: string): number {
  const a = Date.parse(`${ymd}T12:00:00`);
  const b = Date.parse(`${today}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((a - b) / 86400000));
}

function weekdayShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase();
}

function dateShort(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }).toUpperCase();
}

export function buildHomeUpcomingItems(
  entries: ItineraryEntry[],
  tripDays: TripDay[],
  limit = 3,
  todayYmd = todayYmdLocal()
): HomeUpcomingItem[] {
  const dayById = new Map(tripDays.map((d) => [d.id, d]));
  const parents = entries.filter((e) => !e.parentEntryId);
  const rows: Array<{ ymd: string; time: string; entry: ItineraryEntry; day: TripDay | undefined }> = [];
  for (const e of parents) {
    const day = dayById.get(e.dayId);
    if (!day || isPreTripDayRow(day)) continue;
    const ymd = (day.calendarDate || '').slice(0, 10);
    if (!ymd || ymd < todayYmd) continue;
    const time = (e.timeStart || '').trim();
    if (!time && e.category !== 'Flights' && e.category !== 'Accommodation') continue;
    rows.push({ ymd, time, entry: e, day });
  }
  rows.sort((a, b) => {
    const d = a.ymd.localeCompare(b.ymd);
    if (d !== 0) return d;
    return (a.time || '99:99').localeCompare(b.time || '99:99');
  });
  return rows.slice(0, limit).map(({ ymd, time, entry, day }) => {
    const until = daysUntil(ymd, todayYmd);
    const subParts: string[] = [];
    if (time) subParts.push(formatTimeHHMM(time));
    if (entry.location?.trim()) subParts.push(entry.location.trim());
    return {
      id: entry.id,
      title: entry.title || entry.category || 'Itinerary item',
      sub: subParts.join(' · ') || undefined,
      dayLabel: `${weekdayShort(ymd)} ${dateShort(ymd)}`,
      ymd,
      daysUntil: until
    };
  });
}
