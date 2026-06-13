import { formatTimeHHMM } from './itineraryTimeUtils';

/** Parse duration strings like "2h 30m", "45m", "1h" into minutes. */
export function parseDurationMinutes(duration: string): number {
  const t = (duration || '').trim().toLowerCase();
  if (!t) return 0;
  let total = 0;
  const h = t.match(/(\d+)\s*h/);
  const m = t.match(/(\d+)\s*m/);
  if (h) total += Number(h[1]) * 60;
  if (m) total += Number(m[1]);
  if (!h && !m && /^\d+$/.test(t)) total = Number(t);
  return total;
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

/** Compute arrival time from departure + duration (supports overnight). */
export function arrivalTimeFromDuration(options: {
  startDate?: string;
  startTime?: string;
  duration?: string;
}): { arrivalDate: string; arrivalTime: string } | null {
  const sd = (options.startDate || '').slice(0, 10);
  const st = formatTimeHHMM(options.startTime || '');
  const mins = parseDurationMinutes(options.duration || '');
  if (!sd || !st || mins <= 0) return null;
  const start = new Date(`${sd}T${st}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + mins * 60000);
  const arrivalDate = end.toISOString().slice(0, 10);
  const arrivalTime = formatTimeHHMM(`${end.getHours()}:${end.getMinutes()}`);
  return arrivalDate && arrivalTime ? { arrivalDate, arrivalTime } : null;
}
