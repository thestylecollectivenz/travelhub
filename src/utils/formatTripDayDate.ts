export type DateFormatPref = 'DMY' | 'MDY';

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function parseCalendarDate(calendarDate: string): Date | null {
  const raw = (calendarDate || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Route strip label, e.g. Day 6 — Fri, 30 Oct */
export function formatRouteStripDayLabel(dayNumber: number, calendarDate: string): string {
  const d = parseCalendarDate(calendarDate);
  if (!d) return `Day ${dayNumber}`;
  const weekday = d.toLocaleDateString('en-NZ', { weekday: 'short' });
  const month = d.toLocaleDateString('en-NZ', { month: 'short' });
  const day = d.getDate();
  return `Day ${dayNumber} - ${weekday}, ${day} ${month}`;
}

/** Natural language day date, e.g. 29th May 2026 */
export function formatOrdinalDayDate(calendarDate: string): string {
  const d = parseCalendarDate(calendarDate);
  if (!d) return (calendarDate || '').trim();
  const day = d.getDate();
  const month = d.toLocaleDateString('en-NZ', { month: 'long' });
  const year = d.getFullYear();
  return `${day}${ordinalSuffix(day)} ${month} ${year}`;
}

/** Trip date range for export cover, e.g. 28th to 31st May 2026 */
export function formatOrdinalDateRange(startDate: string, endDate: string): string {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);
  if (!start || !end) return `${startDate} to ${endDate}`;
  const sd = start.getDate();
  const ed = end.getDate();
  const sm = start.getMonth();
  const em = end.getMonth();
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy === ey && sm === em) {
    if (sd === ed) return formatOrdinalDayDate(startDate);
    const month = start.toLocaleDateString('en-NZ', { month: 'long' });
    return `${sd}${ordinalSuffix(sd)} to ${ed}${ordinalSuffix(ed)} ${month} ${sy}`;
  }
  return `${formatOrdinalDayDate(startDate)} to ${formatOrdinalDayDate(endDate)}`;
}

/** Legacy slash format (kept for any numeric-only contexts). */
export function formatTripDayDate(calendarDate: string, format: DateFormatPref): string {
  const raw = (calendarDate || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return format === 'MDY' ? `${mo}/${d}/${y}` : `${d}/${mo}/${y}`;
}
