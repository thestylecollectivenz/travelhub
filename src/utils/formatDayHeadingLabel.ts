import type { TripDay } from '../models/TripDay';

/** Short date beside day number — matches sidebar (e.g. Thu 28 May). */
export function formatSidebarDayDate(calendarDate: string): string {
  const raw = (calendarDate || '').trim();
  if (!raw) return '';
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Journal day section heading — always "Day N - Title" (avoids doubling if title already has Day N). */
export function formatJournalDayTitle(day: TripDay): string {
  if (day.dayType === 'PreTrip') return 'Pre-trip';
  const title = (day.displayTitle || '').trim();
  if (!title) return `Day ${day.dayNumber}`;
  // Already "Day 1 - …" / "Day 1 — …" / "Day 1: …"
  if (new RegExp(`^day\\s*${day.dayNumber}\\s*[-–—:]\\s*`, 'i').test(title)) {
    return title.replace(/^day\s*/i, 'Day ');
  }
  // Title is just "Day 1" (auto default)
  if (new RegExp(`^day\\s*${day.dayNumber}$`, 'i').test(title)) {
    return `Day ${day.dayNumber}`;
  }
  return `Day ${day.dayNumber} - ${title}`;
}

/** Photo album / grouped day headings: Day 1 | Thu 28 May */
export function formatDayPhotoSectionTitle(day: TripDay): string {
  if (day.dayType === 'PreTrip') return 'Pre-trip';
  const datePart = formatSidebarDayDate(day.calendarDate);
  const base = `Day ${day.dayNumber}`;
  return datePart ? `${base} | ${datePart}` : base;
}
