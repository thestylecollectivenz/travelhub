import { formatTimeHHMM } from './itineraryTimeUtils';

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
