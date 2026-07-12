import type { ItinerarySubItem } from '../models/ItineraryEntry';

export function ymdSlice(value: string | undefined): string {
  return (value || '').slice(0, 10);
}

/** When optionDate is set, show only on that calendar day; otherwise show every day (legacy). */
export function subItemMatchesCalendarDate(sub: ItinerarySubItem, calendarDate: string): boolean {
  const opt = ymdSlice(sub.optionDate);
  if (!opt) return true;
  return opt === ymdSlice(calendarDate);
}

export function filterSubItemsForDay(
  subs: ItinerarySubItem[] | undefined,
  calendarDate: string
): ItinerarySubItem[] {
  return (subs ?? []).filter((s) => subItemMatchesCalendarDate(s, calendarDate));
}
