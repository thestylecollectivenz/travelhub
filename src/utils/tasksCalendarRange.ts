import { localYmd, parseYmd } from './localDate';

export { localYmd } from './localDate';

export type CalendarRangeFilter =
  | 'this_week'
  | 'this_month'
  | 'next_week'
  | 'next_month'
  | 'all'
  | 'custom';

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function rangeForCalendarFilter(
  filter: CalendarRangeFilter,
  custom?: { start: string; end: string }
): { start: Date; end: Date } {
  if (filter === 'custom' && custom?.start && custom?.end) {
    const start = parseYmd(custom.start) ?? startOfDay(new Date());
    const end = parseYmd(custom.end) ?? start;
    return start.getTime() <= end.getTime() ? { start, end } : { start: end, end: start };
  }

  const today = startOfDay(new Date());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisWeekStart = addDays(today, mondayOffset);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextWeekEnd = addDays(nextWeekStart, 6);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  switch (filter) {
    case 'this_week':
      return { start: thisWeekStart, end: thisWeekEnd };
    case 'next_week':
      return { start: nextWeekStart, end: nextWeekEnd };
    case 'this_month':
      return { start: thisMonthStart, end: thisMonthEnd };
    case 'next_month':
      return { start: nextMonthStart, end: nextMonthEnd };
    default:
      return { start: addDays(today, -3650), end: addDays(today, 3650) };
  }
}

export function ymdInRange(ymd: string, start: Date, end: Date): boolean {
  const s = localYmd(start);
  const e = localYmd(end);
  return ymd >= s && ymd <= e;
}

/** Prefer trip start month when viewing calendar for a future trip. */
export function initialCalendarMonth(events: { date: string }[], tripStartYmd?: string): Date {
  if (tripStartYmd) {
    const t = parseYmd(tripStartYmd);
    if (t) return new Date(t.getFullYear(), t.getMonth(), 1);
  }
  const sorted = [...events].map((e) => e.date).filter(Boolean).sort();
  if (sorted.length) {
    const d = parseYmd(sorted[0]);
    if (d) return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  const today = startOfDay(new Date());
  return new Date(today.getFullYear(), today.getMonth(), 1);
}
