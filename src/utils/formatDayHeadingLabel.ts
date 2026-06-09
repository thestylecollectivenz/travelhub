import type { TripDay } from '../models/TripDay';

/** Short date beside day number — matches sidebar (e.g. Thu 28 May). */
export function formatSidebarDayDate(calendarDate: string): string {
  const raw = (calendarDate || '').trim();
  if (!raw) return '';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Journal day section heading — sidebar display title only (no extra Day n prefix). */
export function formatJournalDayTitle(day: TripDay): string {
  if (day.dayType === 'PreTrip') return 'Pre-trip';
  return day.displayTitle?.trim() || `Day ${day.dayNumber}`;
}

/** Photo album / grouped day headings: Day 1 | Thu 28 May */
export function formatDayPhotoSectionTitle(day: TripDay): string {
  if (day.dayType === 'PreTrip') return 'Pre-trip';
  const datePart = formatSidebarDayDate(day.calendarDate);
  const base = `Day ${day.dayNumber}`;
  return datePart ? `${base} | ${datePart}` : base;
}
