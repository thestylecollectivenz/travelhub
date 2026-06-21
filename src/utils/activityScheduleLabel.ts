import { arrivalTimeFromDuration } from './durationFromTimes';
import { formatTimeHHMM } from './itineraryTimeUtils';

function durationDisplayValue(duration: string | undefined): string {
  const d = (duration || '').trim();
  if (!d) return '';
  if (/^\d+(\.\d+)?$/.test(d)) return '';
  return d;
}

/** Prominent activity schedule line (start–end, duration — no transport wording). */
export function formatActivityScheduleHero(options: {
  calendarDate?: string;
  timeStart?: string;
  duration?: string;
  arrivalTime?: string;
}): string | null {
  return formatActivityScheduleLabel(options) ?? null;
}

/** Activity / option schedule: start, optional end (computed from duration), duration label. */
export function formatActivityScheduleLabel(options: {
  calendarDate?: string;
  timeStart?: string;
  duration?: string;
  arrivalTime?: string;
}): string | undefined {
  const start = formatTimeHHMM(options.timeStart || '');
  const duration = durationDisplayValue(options.duration);
  let end = formatTimeHHMM(options.arrivalTime || '');

  if (!end && start && duration && options.calendarDate) {
    const computed = arrivalTimeFromDuration({
      startDate: options.calendarDate,
      startTime: options.timeStart,
      duration
    });
    if (computed) end = computed.arrivalTime;
  }

  if (start && end) {
    return `${start}–${end}${duration ? ` · ${duration}` : ''}`;
  }
  if (start && duration) return `${start} · ${duration}`;
  if (start) return start;
  if (duration) return duration;
  if (end) return end;
  return undefined;
}
