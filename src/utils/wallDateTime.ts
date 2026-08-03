/**
 * Wall-clock date/time helpers — no browser/SharePoint timezone conversion.
 * Values are treated as the exact date and time the user entered.
 * Storage form for SharePoint DateTime fields: YYYY-MM-DDTHH:mm:00.000Z
 * (UTC-tagged wall clock; display always uses the UTC components).
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

const WALL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/;

export interface WallDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Parse a stored ISO / datetime-local string into wall-clock parts (no TZ shift). */
export function parseWallDateTimeParts(value: string | undefined | null): WallDateTimeParts | undefined {
  if (!value) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;

  const m = s.match(WALL_RE);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Math.min(23, Number(m[4])),
      minute: Math.min(59, Number(m[5])),
      second: Math.min(59, Number(m[6] ?? '0'))
    };
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds()
  };
}

/** Value for `<input type="datetime-local">` (YYYY-MM-DDTHH:mm). */
export function toDateTimeLocalValue(value: string | undefined | null): string {
  const p = parseWallDateTimeParts(value);
  if (!p) return '';
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Serialize datetime-local / wall-clock input for SharePoint DateTime.
 * Does not apply local timezone — the typed clock time is stored as-is.
 */
export function serializeWallDateTime(value: string | undefined | null): string | null {
  if (!value || !String(value).trim()) return null;
  const p = parseWallDateTimeParts(value);
  if (!p) return String(value).trim();
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:00.000Z`;
}

/** en-NZ date + 24h time from wall clock, e.g. "22/10/2026 at 12:00". */
export function formatWallDateTimeEnNz(value: string | undefined | null, opts?: { withAt?: boolean }): string {
  const p = parseWallDateTimeParts(value);
  if (!p) return (value || '').trim();
  const dateStr = `${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
  const timeStr = `${pad2(p.hour)}:${pad2(p.minute)}`;
  if (opts?.withAt === false) return `${dateStr}, ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}

/** Short due line: "Due 22/10/2026, 12:00". */
export function formatWallDueLine(value: string | undefined | null): string {
  const p = parseWallDateTimeParts(value);
  if (!p) return '';
  return `Due ${pad2(p.day)}/${pad2(p.month)}/${p.year}, ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Reminder/task due label without timezone shift.
 * Midnight wall-clock → date only; otherwise date + time.
 */
export function formatReminderDueLabel(value: string | undefined | null): string {
  const p = parseWallDateTimeParts(value);
  if (!p) return value ? `Due ${String(value).trim()}` : 'No due date';
  if (p.hour === 0 && p.minute === 0 && p.second === 0) {
    return `Due ${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
  }
  return formatWallDueLine(value);
}
