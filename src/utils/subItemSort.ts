import type { ItinerarySubItem } from '../models/ItineraryEntry';
import { minutesFromTimeStart } from './itineraryTimeUtils';

/** Insert or re-slot an option by start time; untimed options go to the bottom. */
export function insertSubItemByTime(subs: ItinerarySubItem[], incoming: ItinerarySubItem): ItinerarySubItem[] {
  const without = subs.filter((s) => s.id !== incoming.id);
  const incomingMin = minutesFromTimeStart(incoming.startTime || '');
  let insertAt = without.length;
  if (incomingMin !== undefined) {
    const idx = without.findIndex((s) => {
      const m = minutesFromTimeStart(s.startTime || '');
      return m !== undefined && m > incomingMin;
    });
    insertAt = idx < 0 ? without.length : idx;
  }
  const next = [...without];
  next.splice(insertAt, 0, incoming);
  return next.map((s, i) => ({ ...s, sortOrder: i }));
}
