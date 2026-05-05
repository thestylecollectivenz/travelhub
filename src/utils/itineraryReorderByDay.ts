import type { ItineraryEntry } from '../models/ItineraryEntry';

/**
 * After a visual reorder of top-level entries on a calendar day (including carryovers from other days),
 * produce ordered id lists per home `dayId` for SharePoint `SortOrder` persistence.
 */
export function orderIdsByHomeDayFromVisualList(reordered: ItineraryEntry[]): Map<string, string[]> {
  const byDay = new Map<string, string[]>();
  for (const e of reordered) {
    if (e.parentEntryId) {
      continue;
    }
    const list = byDay.get(e.dayId) ?? [];
    list.push(e.id);
    byDay.set(e.dayId, list);
  }
  return byDay;
}
