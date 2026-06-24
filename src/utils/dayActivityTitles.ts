import type { ItineraryEntry } from '../models/ItineraryEntry';

/** Activity card titles on a day (main entries + options) for transport "from" suggestions. */
export function activityTitlesForDay(
  dayId: string,
  entries: ItineraryEntry[],
  excludeEntryId?: string
): string[] {
  const titles = new Set<string>();
  for (const e of entries) {
    if (e.dayId !== dayId || e.id === excludeEntryId || e.parentEntryId) continue;
    if ((e.category || '').trim() === 'Activities') {
      const t = (e.title || '').trim();
      if (t) titles.add(t);
    }
    for (const sub of e.subItems ?? []) {
      if ((sub.category || '').trim() === 'Activities') {
        const t = (sub.title || '').trim();
        if (t) titles.add(t);
      }
    }
  }
  return Array.from(titles).sort((a, b) => a.localeCompare(b));
}
