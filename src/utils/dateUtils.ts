function toSafeDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(`${value}T12:00:00`);
}

/** e.g. "Saturday 5 April 2026" */
export function formatDayDate(date: Date | string): string {
  return toSafeDate(date).toLocaleDateString('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/** e.g. "5 Apr – 14 Apr 2026" */
export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = toSafeDate(start);
  const e = toSafeDate(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startPart = s.toLocaleDateString('en-NZ', opts);
  const endPart = e.toLocaleDateString('en-NZ', { ...opts, year: 'numeric' });
  return `${startPart} – ${endPart}`;
}
