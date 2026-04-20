/**
 * Parse `timeStart` (ISO-like datetime string) for sorting and display.
 * Empty or invalid values sort after timed entries (stable tie-break via sortOrder).
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function minutesFromTimeStart(timeStart: string): number | undefined {
  if (!timeStart || !timeStart.trim()) {
    return undefined;
  }
  const d = new Date(timeStart);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  return d.getHours() * 60 + d.getMinutes();
}

/** "HH:MM" for timeline label and time input, or empty string. */
export function formatTimeHHMM(timeStart: string): string {
  const m = minutesFromTimeStart(timeStart);
  if (m === undefined) {
    return '';
  }
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${pad2(h)}:${pad2(min)}`;
}

/** Build ISO local datetime from YYYY-MM-DD + HTML time value "HH:MM". */
export function combineDayAndTime(calendarDate: string, timeHHMM: string): string {
  const t = timeHHMM.trim();
  if (!t) {
    return '';
  }
  const parts = t.split(':');
  const hNum = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0));
  const mNum = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0));
  return `${calendarDate}T${pad2(hNum)}:${pad2(mNum)}:00`;
}
