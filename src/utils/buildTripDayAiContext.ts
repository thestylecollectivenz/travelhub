import type { ItineraryEntry, ItinerarySubItem } from '../models/ItineraryEntry';
import type { Trip } from '../models/Trip';
import type { TripDay } from '../models/TripDay';
import { formatTimeHHMM } from './itineraryTimeUtils';
import { formatLocationText, placeDisplayLabel } from './placeDisplayLabel';
import { isPreTripDayRow, resolvePreTripDayId, sortEntriesForDay } from './itineraryDayEntries';
import type { Place } from '../models/Place';
import { formatYmdDisplay } from './localDate';
import { localTodayYmd } from './taskDueBuckets';
import { collectPlaceIdsForDay } from './locationInfoDayResolve';
import { findStayTileForDay } from './mobileDayStay';
import { isLocationInfoEntry } from './locationInfoEntry';

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

/** Schedule + planning status — no costs, notes, booking refs, or other private fields. */
function formatPlanningStatus(entry: Pick<ItineraryEntry, 'decisionStatus' | 'bookingRequired' | 'bookingStatus' | 'paymentStatus' | 'amount'>): string {
  const parts: string[] = [];
  const decision = entry.decisionStatus || 'Planned';
  if (decision === 'Idea') parts.push('idea only');
  else if (decision === 'Confirmed') parts.push('confirmed');
  else parts.push('planned');
  if (entry.bookingRequired) {
    parts.push(entry.bookingStatus === 'Booked' ? 'booked' : 'needs booking');
  }
  if (entry.paymentStatus === 'Part paid' || entry.paymentStatus === 'Fully paid' || entry.paymentStatus === 'Free') {
    parts.push(`payment: ${entry.paymentStatus}`);
  } else if (entry.amount > 0) {
    parts.push('unpaid');
  }
  return parts.join(', ');
}

function formatOptionPlanningStatus(option: ItinerarySubItem): string {
  const parts: string[] = [];
  if (option.decisionStatus === 'Idea') parts.push('idea');
  else if (option.decisionStatus === 'Confirmed') parts.push('confirmed');
  else parts.push('planned');
  if (option.bookingRequired) parts.push('booking required');
  if (option.paymentStatus && option.paymentStatus !== 'Not paid') {
    parts.push(`payment: ${option.paymentStatus}`);
  }
  return parts.join(', ');
}

function summarizeEntryForAi(entry: ItineraryEntry): string {
  const parts: string[] = [];
  const title = (entry.title || 'Untitled').trim();
  const cat = (entry.category || '').trim();
  if (cat) parts.push(cat);
  parts.push(title);
  const start = formatTimeHHMM(entry.timeStart || '');
  const end = formatTimeHHMM(entry.arrivalTime || '');
  if (start && end) parts.push(`${start}–${end}`);
  else if (start) parts.push(start);
  if (entry.location?.trim()) parts.push(`@ ${formatLocationText(entry.location.trim())}`);
  if (entry.streetAddress?.trim()) parts.push(`address: ${entry.streetAddress.trim()}`);
  parts.push(formatPlanningStatus(entry));
  const options = (entry.subItems ?? []).filter((s) => (s.title || '').trim());
  if (options.length) {
    parts.push(
      `options: ${options
        .slice(0, 8)
        .map((s) => {
          const t0 = formatTimeHHMM(s.startTime || '');
          const label = (s.title || 'Option').trim();
          const status = formatOptionPlanningStatus(s);
          const core = t0 ? `${t0} ${label}` : label;
          return `${core} (${status})`;
        })
        .join('; ')}`
    );
  }
  return parts.join(' · ');
}

function buildFullItineraryOutline(
  trip: Trip,
  tripDays: TripDay[],
  entries: ItineraryEntry[],
  placeForDay: (day: TripDay) => Pick<Place, 'title' | 'country'> | undefined
): string[] {
  const lines: string[] = [
    'Full trip outline (days, dates, places, card titles, and planning/booking status — no costs or notes):'
  ];
  const preTripDayId = resolvePreTripDayId(tripDays, trip.id);
  const sortedDays = [...tripDays].sort((a, b) => a.dayNumber - b.dayNumber);
  for (const d of sortedDays) {
    const date = d.calendarDate?.slice(0, 10) ?? '';
    const place = placeForDay(d);
    const placeLabel = place ? placeDisplayLabel(place) : undefined;
    const headerParts = [`Day ${d.dayNumber}`];
    if (date) headerParts.push(date);
    headerParts.push(d.displayTitle?.trim() || 'Untitled');
    if (placeLabel) headerParts.push(placeLabel);
    lines.push(headerParts.join(' · '));

    const dayEntries = sortEntriesForDay(
      entries,
      d.id,
      d.calendarDate || '',
      d.dayType,
      preTripDayId,
      isPreTripDayRow(d),
      tripDays
    );

    if (dayEntries.length) {
      dayEntries.forEach((e) => lines.push(`  - ${summarizeEntryForAi(e)}`));
    } else {
      lines.push('  - (no cards yet)');
    }
  }
  return lines;
}

export function buildTripDayAiContext(options: {
  trip: Trip;
  tripDays: TripDay[];
  day?: TripDay;
  entries: ItineraryEntry[];
  placeTitle?: string;
  placeForDay?: (day: TripDay) => Pick<Place, 'title' | 'country'> | undefined;
  hemisphere?: 'north' | 'south';
  daySpecific?: boolean;
}): string {
  const {
    trip,
    tripDays,
    day,
    entries,
    placeTitle,
    placeForDay,
    hemisphere = 'north',
    daySpecific = true
  } = options;
  const lines: string[] = [];

  lines.push(`Trip: ${trip.title || 'Untitled'}`);
  if (trip.destination?.trim()) lines.push(`Destination: ${trip.destination.trim()}`);
  if (trip.dateStart && trip.dateEnd) {
    lines.push(`Trip dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}`);
  }

  if (tripDays.length) {
    lines.push('');
    lines.push(...buildFullItineraryOutline(trip, tripDays, entries, placeForDay ?? (() => undefined)));
  }

  if (daySpecific && day) {
    lines.push('');
    lines.push(`Selected day (focus here): Day ${day.dayNumber} — ${day.displayTitle || 'Untitled'}`);
    if (day.calendarDate) {
      lines.push(`Calendar date: ${day.calendarDate}`);
      const season = seasonLabel(day.calendarDate, hemisphere);
      if (season) lines.push(`Season (${hemisphere}ern hemisphere): ${season}`);
    }
    lines.push(`Day type: ${dayTypeLabel(day.dayType)}`);
    if (placeTitle?.trim()) lines.push(`Primary place: ${formatLocationText(placeTitle.trim())}`);

    const preTripDayId = resolvePreTripDayId(tripDays, trip.id);
    const dayEntries = sortEntriesForDay(
      entries,
      day.id,
      day.calendarDate || '',
      day.dayType,
      preTripDayId,
      isPreTripDayRow(day),
      tripDays
    );

    lines.push('');
    if (dayEntries.length) {
      lines.push('Detail for selected day:');
      dayEntries.forEach((e) => lines.push(`- ${summarizeEntryForAi(e)}`));
    } else {
      lines.push('Detail for selected day: (nothing scheduled yet)');
    }
  }

  lines.push('');
  lines.push(
    'Privacy: this context is sent only with the traveller’s own Gemini API key in their browser session — not shared with other SharePoint users.'
  );
  lines.push('');
  lines.push(
    daySpecific
      ? 'When answering, use the CURRENT FOCUS day, calendar date, and location — the traveller may change day between messages. Tailor advice to what is already planned on that day.'
      : 'Answer at trip level using the full outline above unless the traveller asks about a specific day.'
  );

  return lines.join('\n');
}

/**
 * Context for Location Info Q&A about a specific place — hotels/stays and plans
 * for every day at that place, plus a full trip outline (same grounding idea as the AI helper).
 */
export function buildLocationPlaceAiContext(options: {
  trip: Trip;
  tripDays: TripDay[];
  entries: ItineraryEntry[];
  place: Place;
  placeForDay?: (day: TripDay) => Pick<Place, 'title' | 'country'> | undefined;
}): string {
  const { trip, tripDays, entries, place, placeForDay } = options;
  const placeLabel = placeDisplayLabel(place);
  const lines: string[] = [];

  lines.push(`Trip: ${trip.title || 'Untitled'}`);
  if (trip.destination?.trim()) lines.push(`Destination: ${trip.destination.trim()}`);
  if (trip.dateStart && trip.dateEnd) {
    lines.push(`Trip dates: ${trip.dateStart.slice(0, 10)} to ${trip.dateEnd.slice(0, 10)}`);
  }
  lines.push(`Place this question is about: ${placeLabel}`);
  lines.push('');

  const daysAtPlace = tripDays
    .filter((d) => d.tripId === trip.id)
    .filter((d) => collectPlaceIdsForDay(d).indexOf(place.id) >= 0)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const staySeen = new Set<string>();
  const stayLines: string[] = [];
  const planLines: string[] = [];
  const preTripDayId = resolvePreTripDayId(tripDays, trip.id);

  for (const d of daysAtPlace) {
    const date = d.calendarDate?.slice(0, 10) ?? '';
    const stay = findStayTileForDay(entries, date);
    if (stay && !staySeen.has(stay.entry.id)) {
      staySeen.add(stay.entry.id);
      const kind = stay.mode === 'cruise' ? 'Cruise / ship stay' : 'Hotel / accommodation';
      const name = (stay.entry.title || '').trim() || kind;
      const addr = (stay.entry.streetAddress || stay.entry.location || '').trim();
      const dates =
        stay.mode === 'cruise'
          ? [stay.entry.embarksDate, stay.entry.disembarksDate]
              .map((x) => (x || '').slice(0, 10))
              .filter(Boolean)
              .join(' → ')
          : [stay.entry.dateStart, stay.entry.dateEnd]
              .map((x) => (x || '').slice(0, 10))
              .filter(Boolean)
              .join(' → ');
      stayLines.push(
        `- ${kind}: ${name}${addr ? ` · ${addr}` : ''}${dates ? ` · ${dates}` : ''} (${formatPlanningStatus(stay.entry)})`
      );
    }

    const dayEntries = sortEntriesForDay(
      entries,
      d.id,
      d.calendarDate || '',
      d.dayType,
      preTripDayId,
      isPreTripDayRow(d),
      tripDays
    ).filter((e) => !isLocationInfoEntry(e));

    if (dayEntries.length) {
      planLines.push(
        `Day ${d.dayNumber}${date ? ` (${date})` : ''} — ${(d.displayTitle || 'Untitled').trim()}:`
      );
      dayEntries.forEach((e) => planLines.push(`  - ${summarizeEntryForAi(e)}`));
    }
  }

  lines.push('Overnight stays for days that include this place (use when the traveller asks about “our hotel” / “our stay”):');
  if (stayLines.length) {
    stayLines.forEach((l) => lines.push(l));
  } else {
    lines.push(
      '- (no overnight hotel/cruise stay linked on days at this place — it may be a day visit from another overnight base)'
    );
  }
  lines.push(
    'Note: If this place is only visited as a day trip, do not expect or mention a hotel here; use the overnight base from the itinerary instead.'
  );

  lines.push('');
  lines.push('Plans and itinerary items on days at this place:');
  if (planLines.length) {
    planLines.forEach((l) => lines.push(l));
  } else {
    lines.push('- (nothing scheduled on days at this place yet)');
  }

  if (tripDays.length) {
    lines.push('');
    lines.push(...buildFullItineraryOutline(trip, tripDays, entries, placeForDay ?? (() => undefined)));
  }

  lines.push('');
  lines.push(
    'When answering: treat the stay listed above as their hotel/ship for this place. Use planned items by day. Prefer concrete advice relative to their hotel and schedule. Do not invent a different hotel name.'
  );

  return lines.join('\n');
}

const WORKSPACE_TAB_LABELS: Record<string, string> = {
  itinerary: 'Itinerary',
  journal: 'Journal',
  photos: 'Photos',
  budget: 'Budget',
  map: 'Map',
  files: 'Files & links',
  plan: 'Plan'
};

/** Short, emphatic block repeated on every AI turn so replies track the current day/place. */
export function buildAiCurrentFocusBlock(options: {
  isTasksView: boolean;
  dayScope: 'day' | 'general';
  selectedDay?: TripDay;
  placeTitle?: string;
  mainWorkspaceTab?: string;
  todayYmd?: string;
}): string {
  const { isTasksView, dayScope, selectedDay, placeTitle, mainWorkspaceTab, todayYmd } = options;
  const today = todayYmd ?? localTodayYmd();
  const lines: string[] = [
    '=== CURRENT FOCUS (authoritative for this reply — read before answering) ===',
    'The traveller may have changed day or location since earlier messages. Earlier chat may refer to a different place — do not assume the conversation is still about that place.',
    'Always answer for the day, calendar date, and location listed here unless the latest message explicitly names another day or place.'
  ];

  if (isTasksView) {
    lines.push(`Today's date (local): ${today}`);
    lines.push('Context: To-do list — bookings, payments, reminders, and manual tasks');
  } else {
    const tabLabel = mainWorkspaceTab ? WORKSPACE_TAB_LABELS[mainWorkspaceTab] || mainWorkspaceTab : undefined;
    if (tabLabel) lines.push(`App view: ${tabLabel}`);
    lines.push(`Context scope: ${dayScope === 'day' ? 'Selected day only' : 'Whole trip'}`);

    if (selectedDay) {
      const dateYmd = selectedDay.calendarDate?.slice(0, 10) ?? '';
      const dateLabel = formatYmdDisplay(dateYmd) || dateYmd;
      lines.push(
        `Selected day: Day ${selectedDay.dayNumber} — ${(selectedDay.displayTitle || 'Untitled').trim()}${dateLabel ? ` (${dateLabel})` : ''}`
      );
      if (dateYmd) lines.push(`Calendar date: ${dateYmd}`);
      lines.push(`Day type: ${dayTypeLabel(selectedDay.dayType)}`);
    } else {
      lines.push('Selected day: (none — traveller has not selected a day in the sidebar)');
    }

    if (placeTitle?.trim()) {
      lines.push(`Primary location: ${formatLocationText(placeTitle.trim())}`);
    } else if (selectedDay && dayScope === 'day') {
      lines.push('Primary location: (not set on this day)');
    }
  }

  return lines.join('\n');
}
