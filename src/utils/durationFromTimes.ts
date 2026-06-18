import { formatTimeHHMM, minutesFromTimeStart } from './itineraryTimeUtils';

/** Parse duration strings like "2h 30m", "45m", "1h" into minutes. */
export function parseDurationMinutes(duration: string): number {
  const t = (duration || '').trim().toLowerCase();
  if (!t) return 0;
  let total = 0;
  const h = t.match(/(\d+)\s*h/);
  const m = t.match(/(\d+)\s*m(?!\w)/);
  if (h) total += Number(h[1]) * 60;
  if (m) total += Number(m[1]);
  if (!h && !m && /^\d+$/.test(t)) total = Number(t);
  return total;
}

/** Only auto-calculate end times when duration has an explicit unit (avoids "6" → 6 min). */
export function isDurationExpressionComplete(duration: string): boolean {
  const t = (duration || '').trim().toLowerCase();
  if (!t) return false;
  if (/\d+\s*h|\d+\s*m/.test(t)) return true;
  if (/^\d{2,}$/.test(t)) return true;
  return false;
}

/** Build a human duration string from start/end date+time fields. */
export function durationFromDateTimes(options: {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}): string {
  const { startDate, startTime, endDate, endTime } = options;
  const sd = (startDate || '').slice(0, 10);
  const ed = (endDate || sd).slice(0, 10);
  const st = formatTimeHHMM(startTime || '');
  const et = formatTimeHHMM(endTime || '');
  if (!sd || !st || !et) return '';
  const start = new Date(`${sd}T${st}:00`);
  const end = new Date(`${ed}T${et}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return '';
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Compute arrival time from departure + duration (supports overnight). */
export function arrivalTimeFromDuration(options: {
  startDate?: string;
  startTime?: string;
  duration?: string;
}): { arrivalDate: string; arrivalTime: string } | null {
  const sd = (options.startDate || '').slice(0, 10);
  const st = formatTimeHHMM(options.startTime || '');
  const duration = options.duration || '';
  if (!isDurationExpressionComplete(duration)) return null;
  const mins = parseDurationMinutes(duration);
  if (!sd || !st || mins <= 0) return null;
  const startM = minutesFromTimeStart(st);
  if (startM === undefined) return null;
  const totalEndM = startM + mins;
  const dayOffset = Math.floor(totalEndM / (24 * 60));
  const endM = ((totalEndM % (24 * 60)) + 24 * 60) % (24 * 60);
  const arrivalTime = `${pad2(Math.floor(endM / 60))}:${pad2(endM % 60)}`;
  const startDateObj = new Date(`${sd}T12:00:00.000Z`);
  if (Number.isNaN(startDateObj.getTime())) return null;
  startDateObj.setUTCDate(startDateObj.getUTCDate() + dayOffset);
  const arrivalDate = startDateObj.toISOString().slice(0, 10);
  return arrivalDate && arrivalTime ? { arrivalDate, arrivalTime } : null;
}
