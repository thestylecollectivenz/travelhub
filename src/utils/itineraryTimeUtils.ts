/**
 * Time storage strategy: times are stored as HH:MM strings internally.
 * When writing to SharePoint (DateTime field) we use a fixed UTC reference
 * date (1970-01-01) so there is no timezone shift on read-back.
 * When reading from SharePoint we extract HH:MM from the UTC time component.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Extract minutes-since-midnight from a stored time string (HH:MM or ISO). */
export function minutesFromTimeStart(timeStart: string): number | undefined {
  if (!timeStart || !timeStart.trim()) return undefined;

  // Already HH:MM
  if (/^\d{2}:\d{2}$/.test(timeStart.trim())) {
    const [h, m] = timeStart.trim().split(':').map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) return h * 60 + m;
    return undefined;
  }

  // ISO datetime — extract UTC hours/minutes to avoid timezone shift
  const d = new Date(timeStart);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "HH:MM" for timeline label and time input, or empty string. */
export function formatTimeHHMM(timeStart: string): string {
  const m = minutesFromTimeStart(timeStart);
  if (m === undefined) return '';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${pad2(h)}:${pad2(min)}`;
}

/**
 * Build a canonical HH:MM string from a calendar date + HTML time input value.
 * We discard the date — only the time matters for storage.
 */
export function combineDayAndTime(calendarDate: string, timeHHMM: string): string {
  const t = timeHHMM.trim();
  if (!t) return '';
  const parts = t.split(':');
  const hNum = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10) || 0));
  const mNum = Math.min(59, Math.max(0, parseInt(parts[1] ?? '0', 10) || 0));
  // Return HH:MM only — date is irrelevant, timezone is irrelevant
  return `${pad2(hNum)}:${pad2(mNum)}`;
}
