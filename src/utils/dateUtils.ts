function toSafeDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(`${value}T12:00:00`);
}

function ordinalDay(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
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

/** e.g. "Monday 5th October" */
export function formatDayDateOrdinal(date: Date | string): string {
  const d = toSafeDate(date);
  const weekday = d.toLocaleDateString('en-NZ', { weekday: 'long' });
  const month = d.toLocaleDateString('en-NZ', { month: 'long' });
  return `${weekday} ${ordinalDay(d.getDate())} ${month}`;
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
