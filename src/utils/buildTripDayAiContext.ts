import type { ItineraryEntry } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import { formatTimeHHMM } from './itineraryTimeUtils';

function seasonLabel(calendarDate: string, hemisphere: 'north' | 'south'): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(calendarDate);
  if (!m) return undefined;
  const month = Number(m[2]);
  if (!month) return undefined;
  const north =
    month === 12 || month <= 2
      ? 'winter'
      : month <= 5
        ? 'spring'
        : month <= 8
          ? 'summer'
          : 'autumn';
  if (hemisphere === 'north') return north;
  const flip: Record<string, string> = {
    winter: 'summer',
    summer: 'winter',
    spring: 'autumn',
    autumn: 'spring'
  };
  return flip[north] ?? north;
}

function dayTypeLabel(dayType: TripDay['dayType']): string {
  switch (dayType) {
    case 'Sea':
      return 'Sea day';
    case 'TravelTransit':
      return 'Transit day';
    case 'PreTrip':
      return 'Pre-trip';
    default:
      return 'Place / port day';
  }
}

function summarizeEntry(entry: ItineraryEntry): string {
  const parts: string[] = [];
  const title = (entry.title || 'Untitled').trim();
  const cat = (entry.category || '').trim();
  if (cat) parts.push(cat);
  parts.push(title);
  const start = formatTimeHHMM(entry.timeStart || '');
  const end = formatTimeHHMM(entry.arrivalTime || '');
  if (start && end) parts.push(`${start}–${end}`);
  else if (start) parts.push(start);
  if (entry.location?.trim()) parts.push(`@ ${entry.location.trim()}`);
  if (entry.decisionStatus) parts.push(entry.decisionStatus);
  if (entry.bookingRequired && entry.bookingStatus === 'Not booked') parts.push('booking needed');
  const options = (entry.subItems ?? []).filter((s) => (s.title || '').trim());
  if (options.length) {
    parts.push(
      `options: ${options
        .slice(0, 6)
        .map((s) => {
          const t0 = formatTimeHHMM(s.startTime || '');
          const label = (s.title || 'Option').trim();
          return t0 ? `${t0} ${label}` : label;
        })
        .join('; ')}`
    );
  }
  return parts.join(' · ');
}

export function buildTripDayAiContext(options: {
  trip: Trip;
  day?: TripDay;
  entries: ItineraryEntry[];
  placeTitle?: string;
  hemisphere?: 'north' | 'south';
}): string {
  const { trip, day, entries, placeTitle, hemisphere = 'north' } = options;
  const lines: string[] = [];

  lines.push(`Trip: ${trip.title || 'Untitled'}`);
  if (trip.destination?.trim()) lines.push(`Destination: ${trip.destination.trim()}`);
  if (trip.dateStart && trip.dateEnd) {
    lines.push(`Trip dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}`);
  }

  if (day) {
    lines.push('');
    lines.push(`Selected day: Day ${day.dayNumber} — ${day.displayTitle || 'Untitled'}`);
    if (day.calendarDate) {
      lines.push(`Calendar date: ${day.calendarDate}`);
      const season = seasonLabel(day.calendarDate, hemisphere);
      if (season) lines.push(`Season (${hemisphere}ern hemisphere): ${season}`);
    }
    lines.push(`Day type: ${dayTypeLabel(day.dayType)}`);
    if (placeTitle?.trim()) lines.push(`Primary place: ${placeTitle.trim()}`);

    const dayEntries = entries
      .filter((e) => e.dayId === day.id && !e.parentEntryId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    lines.push('');
    if (dayEntries.length) {
      lines.push('Itinerary for this day:');
      dayEntries.forEach((e) => lines.push(`- ${summarizeEntry(e)}`));
    } else {
      lines.push('Itinerary for this day: (nothing scheduled yet)');
    }
  }

  lines.push('');
  lines.push(
    'When answering, tailor advice to this calendar date, season, and what is already planned. Mention gaps or timing conflicts when relevant.'
  );

  return lines.join('\n');
}
