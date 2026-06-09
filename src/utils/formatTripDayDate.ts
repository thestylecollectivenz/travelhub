export type DateFormatPref = 'DMY' | 'MDY';

/** Format ISO calendar date (YYYY-MM-DD) for journal day labels. */
export function formatTripDayDate(calendarDate: string, format: DateFormatPref): string {
  const raw = (calendarDate || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return raw;
  const [, y, mo, d] = m;
  return format === 'MDY' ? `${mo}/${d}/${y}` : `${d}/${mo}/${y}`;
}
