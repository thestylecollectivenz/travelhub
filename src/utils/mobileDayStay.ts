import type { ItineraryEntry } from '../models/ItineraryEntry';
import { isAccommodationNightOnCalendarDate } from './itineraryDayEntries';

export function findStayTileForDay(
  entries: ItineraryEntry[],
  calendarDate: string
): { mode: 'accommodation' | 'cruise'; entry: ItineraryEntry } | undefined {
  const ymd = calendarDate.slice(0, 10);
  if (!ymd) return undefined;

  const cruise = entries.find((e) => {
    if (e.category !== 'Cruise' || !e.embarksDate || !e.disembarksDate) return false;
    const day = new Date(`${ymd}T00:00:00.000Z`);
    const start = new Date(`${e.embarksDate.slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(`${e.disembarksDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
  });
  if (cruise) return { mode: 'cruise', entry: cruise };

  const accommodation = entries.find((e) => isAccommodationNightOnCalendarDate(e, calendarDate));
  if (accommodation) return { mode: 'accommodation', entry: accommodation };

  return undefined;
}
